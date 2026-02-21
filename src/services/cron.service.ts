import { eq } from "drizzle-orm";
import { readRuntimeConfig } from "../config";
import { createDb } from "../db/client";
import { botState, messages } from "../db/schema";
import type { AppBindings } from "../types/bindings";
import { generateBotResponse } from "./gemini.service";

export async function syncDiscordMessages(env: AppBindings) {
  // --- Mecanismo de Lock com KV ---
  // Impede que 2 instâncias do Cron rodem ao mesmo tempo e enviem respostas duplicadas
  const lock = await env.discbot.get("sync_lock");
  if (lock) {
    console.log("[Cron] Já existe uma sincronização rodando. Abortando esta execução.");
    return;
  }
  // Cria o lock que expira em 60 segundos (tempo limite máximo de trava)
  await env.discbot.put("sync_lock", "true", { expirationTtl: 60 });

  try {
    const config = readRuntimeConfig(env as any);
    const db = createDb(env.DB);

    // 1. Obter o último ID lido da tabela bot_state
    const stateRow = await db
      .select()
      .from(botState)
      .where(eq(botState.key, "last_message_id"))
      .get();

    let lastMessageId = stateRow?.value;

    // 2. Montar a URL da API do Discord
    let url = `https://discord.com/api/v10/channels/${config.DISCORD_CHANNEL_ID}/messages?limit=100`;
    if (lastMessageId) {
      url += `&after=${lastMessageId}`;
    }

    // 3. Fazer request para a API do Discord
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bot ${config.DISCORD_BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.error(
        "Falha ao buscar mensagens do Discord:",
        response.status,
        await response.text(),
      );
      return;
    }

    const fetchedMessages: any[] = await response.json();

    if (fetchedMessages.length === 0) {
      console.log("Nenhuma mensagem nova no Discord.");
      return;
    }

    // Ordenar mensagens do histórico mais antigo para mais novo, caso chegue invertido
    fetchedMessages.sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    let newLastMessageId = lastMessageId;
    const messagesToInsert = [];
    const mentionsToProcess: any[] = [];

    // 4. Salvar as mensagens novas
    for (const msg of fetchedMessages) {
      // Ignorar se a mensagem estiver vazia
      if (!msg.content && msg.attachments?.length === 0) continue;

      // Verificar se fomos mencionados (ignorando mensagens do próprio bot)
      const isMentioned =
        msg.author.id !== config.DISCORD_CLIENT_ID &&
        (msg.mentions?.some((mention: any) => mention.id === config.DISCORD_CLIENT_ID) ||
          msg.content.includes(`<@${config.DISCORD_CLIENT_ID}>`) ||
          msg.content.includes(config.DISCORD_CLIENT_ID));

      if (isMentioned) {
        mentionsToProcess.push(msg);
      }

      messagesToInsert.push({
        id: msg.id,
        channelId: msg.channel_id,
        authorId: msg.author.id,
        authorUsername: msg.author.username,
        content: msg.content,
        timestamp: msg.timestamp,
      });
      newLastMessageId = msg.id;
    }

    if (messagesToInsert.length > 0) {
      // Inserir mensagens em batch
      await db.insert(messages).values(messagesToInsert).onConflictDoNothing();

      // 5. Atualizar estado do bot
      if (newLastMessageId) {
        await db
          .insert(botState)
          .values({
            key: "last_message_id",
            value: newLastMessageId,
          })
          .onConflictDoUpdate({
            target: botState.key,
            set: { value: newLastMessageId },
          });
      }

      console.log(`[Cron] ${messagesToInsert.length} novas mensagens sincronizadas!`);

      // 6. Integração Final com o Gemini
      if (mentionsToProcess.length > 0) {
        console.log(`[Cron] Encontradas ${mentionsToProcess.length} menções! Gerando respostas com Inteligência Artificial...`);

        // Processa cada menção individualmente
        for (const mention of mentionsToProcess) {
          const userPrompt = `Usuário [${mention.author.username}] diz: ${mention.content}`;

          // Chamando nosso serviço de IA passando o prompt e histórico
          const aiResponse = await generateBotResponse(env, config, userPrompt);

          // Envando resposta pro Discord e respondendo diretamente a mensagem
          await fetch(`https://discord.com/api/v10/channels/${config.DISCORD_CHANNEL_ID}/messages`, {
            method: "POST",
            headers: {
              Authorization: `Bot ${config.DISCORD_BOT_TOKEN}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              content: `<@${mention.author.id}> ${aiResponse}`,
              message_reference: {
                message_id: mention.id
              }
            }),
          });

          console.log(`[Cron] Resposta enviada para ${mention.author.username}!`);
        }
      }
    }
  } finally {
    // 7. Liberar o Lock para as próximas rodadas independente de erro ou acerto
    await env.discbot.delete("sync_lock");
  }
}
