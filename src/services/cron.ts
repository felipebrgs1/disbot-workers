import { ofetch } from "ofetch";
import { eq } from "drizzle-orm";
import { readRuntimeConfig } from "@config";
import { createDb } from "@db/client";
import { botState, messages } from "@db/schema";
import type { AppBindings } from "@appTypes/bindings";
import { embedAndStoreMessages, generateBotResponse } from "./gemini";

export async function syncDiscordMessages(env: AppBindings) {
  const db = createDb(env.DB);

  // --- Mecanismo de Lock com D1 (Substituindo KV para economizar quota) ---
  // Impede que 2 instâncias do Cron rodem ao mesmo tempo e enviem respostas duplicadas
  const lockState = await db
    .select()
    .from(botState)
    .where(eq(botState.key, "sync_lock"))
    .get();

  const now = Date.now();
  if (lockState && parseInt(lockState.value) > now) {
    console.log("[Cron] Já existe uma sincronização rodando (lock ativo no D1). Abortando.");
    return;
  }

  // Cria o lock que expira em 2 minutos (tempo limite de segurança)
  const expirationTime = now + 120000;
  await db
    .insert(botState)
    .values({ key: "sync_lock", value: expirationTime.toString() })
    .onConflictDoUpdate({
      target: botState.key,
      set: { value: expirationTime.toString() },
    });

  try {
    const config = readRuntimeConfig(env as any);

    if (!config.DISCORD_CHANNEL_ID) {
      console.log("[Cron] Variável DISCORD_CHANNEL_ID não configurada. Cron desabilitado.");
      return;
    }

    // 1. Obter o último ID lido da tabela bot_state
    const stateRow = await db
      .select()
      .from(botState)
      .where(eq(botState.key, "last_message_id"))
      .get();

    let currentLastMessageId = stateRow?.value;
    let totalSyncedThisRun = 0;
    const MAX_MESSAGES_PER_RUN = 1000; // Limite de segurança para 1 execução do Worker
    let hasMore = true;

    while (hasMore && totalSyncedThisRun < MAX_MESSAGES_PER_RUN) {
      // 2. Montar a URL da API do Discord
      let url = `https://discord.com/api/v10/channels/${config.DISCORD_CHANNEL_ID}/messages?limit=100`;
      if (currentLastMessageId) {
        url += `&after=${currentLastMessageId}`;
      }

      // 3. Fazer request para a API do Discord
      let fetchedMessages: any[] = [];
      try {
        fetchedMessages = await ofetch(url, {
          method: "GET",
          headers: {
            Authorization: `Bot ${config.DISCORD_BOT_TOKEN}`,
          },
        });
      } catch (err: any) {
        console.error(
          "Falha ao buscar mensagens do Discord:",
          err.status,
          err.data || err.message,
        );
        break;
      }

      if (fetchedMessages.length === 0) {
        if (totalSyncedThisRun === 0) {
          console.log("Nenhuma mensagem nova no Discord.");
        }
        hasMore = false;
        break;
      }

      // Ordenar mensagens do histórico mais antigo para mais novo
      fetchedMessages.sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
      );

      const messagesToInsert = [];
      const mentionsToProcess: any[] = [];

      for (const msg of fetchedMessages) {
        if (!msg.content && msg.attachments?.length === 0) continue;

        const isMentioned =
          msg.author.id !== config.DISCORD_CLIENT_ID &&
          (msg.mentions?.some((mention: any) => mention.id === config.DISCORD_CLIENT_ID) ||
            msg.content.includes(`<@${config.DISCORD_CLIENT_ID}>`) ||
            msg.content.includes(config.DISCORD_CLIENT_ID));

        if (isMentioned) {
          mentionsToProcess.push({ ...msg, isAskCommand: false });
        }

        messagesToInsert.push({
          id: msg.id,
          channelId: msg.channel_id,
          authorId: msg.author.id,
          authorUsername: msg.author.username,
          content: msg.content,
          timestamp: msg.timestamp,
        });
        currentLastMessageId = msg.id;
      }

      if (messagesToInsert.length > 0) {
        // Inserir mensagens em batch no BD
        await db.insert(messages).values(messagesToInsert).onConflictDoNothing();

        // Incorporar novo histórico no Vectorize (Mais rápido agora com Batching)
        await embedAndStoreMessages(env, config, messagesToInsert);

        // 5. Atualizar estado do bot no banco
        await db
          .insert(botState)
          .values({ key: "last_message_id", value: currentLastMessageId! })
          .onConflictDoUpdate({
            target: botState.key,
            set: { value: currentLastMessageId! },
          });

        totalSyncedThisRun += messagesToInsert.length;
        console.log(`[Cron] Batch de ${messagesToInsert.length} mensagens sincronizado. Total: ${totalSyncedThisRun}`);

        // 6. Responder menções (Apenas na última mensagem para não spammar se houver várias acumuladas)
        if (mentionsToProcess.length > 0) {
          const mention = mentionsToProcess[mentionsToProcess.length - 1]; // Pega a mais recente do batch
          console.log(`[Cron] Respondendo menção de ${mention.author.username}...`);

          const userPrompt = `Usuário [${mention.author.username}] diz: ${mention.content}`;
          const aiResponse = await generateBotResponse(
            env,
            config,
            userPrompt,
            mention.isAskCommand,
            mention.channel_id,
          );

          await ofetch(
            `https://discord.com/api/v10/channels/${config.DISCORD_CHANNEL_ID}/messages`,
            {
              method: "POST",
              headers: {
                Authorization: `Bot ${config.DISCORD_BOT_TOKEN}`,
              },
              body: {
                content: `<@${mention.author.id}> ${aiResponse}`,
                message_reference: { message_id: mention.id },
              },
            },
          );
        }
      }

      // Se veio menos de 100, significa que alcançamos o "topo" do canal
      if (fetchedMessages.length < 100) {
        hasMore = false;
      }
    }

    if (totalSyncedThisRun > 0) {
      console.log(`[Cron] Sincronização finalizada: ${totalSyncedThisRun} mensagens processadas.`);
    }
  } finally {
    // 7. Liberar o Lock para as próximas rodadas independente de erro ou acerto
    await db.delete(botState).where(eq(botState.key, "sync_lock"));
  }
}
