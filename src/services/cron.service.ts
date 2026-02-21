import { eq } from "drizzle-orm";
import { readRuntimeConfig } from "../config";
import { createDb } from "../db/client";
import { botState, messages } from "../db/schema";
import type { AppBindings } from "../types/bindings";

export async function syncDiscordMessages(env: AppBindings) {
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
      await response.text()
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
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  let newLastMessageId = lastMessageId;
  const messagesToInsert = [];

  // 4. Salvar as mensagens novas
  for (const msg of fetchedMessages) {
    // Ignorar se a mensagem estiver vazia
    if (!msg.content && msg.attachments?.length === 0) continue;

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
  }
}
