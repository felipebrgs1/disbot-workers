import { ofetch } from "ofetch";
import type { Context } from "hono";
import { readRuntimeConfig } from "@config";
import { parseDiscordInteraction, verifyDiscordRequest } from "@services/discord-interaction";
import { generateBotResponse } from "@services/gemini";
import type { AppBindings } from "@appTypes/bindings";

type AppContext = Context<{ Bindings: AppBindings }>;

export async function handleDiscordInteraction(c: AppContext) {
  const signature = c.req.header("x-signature-ed25519");
  const timestamp = c.req.header("x-signature-timestamp");
  if (!signature || !timestamp) {
    return c.json({ error: "missing_discord_signature_headers" }, 401);
  }

  const rawBody = await c.req.text();
  const { DISCORD_PUBLIC_KEY } = readRuntimeConfig(c.env);
  const isValidRequest = await verifyDiscordRequest({
    rawBody,
    signature,
    timestamp,
    publicKey: DISCORD_PUBLIC_KEY,
  });
  if (!isValidRequest) {
    return c.json({ error: "invalid_discord_signature" }, 401);
  }

  const interactionResult = parseDiscordInteraction(rawBody);
  if (!interactionResult.success) {
    return c.json({ error: interactionResult.error }, 400);
  }

  const interaction = interactionResult.data;
  if (interaction.type === 1) {
    return c.json({ type: 1 });
  }

  if (interaction.type === 2) {
    const commandName = interaction.data?.name ?? "unknown";

    if (commandName === "ask") {
      const options = interaction.data?.options || [];
      // @ts-ignore
      const questionOption = options.find((opt: any) => opt.name === "pergunta");
      const question = questionOption ? questionOption.value : "";

      const interact = interaction as any;
      const userId = interact.member?.user?.id || interact.user?.id || "";
      const username = interact.member?.user?.username || interact.user?.username || "Alguém";

      const userPrompt = `Usuário [${username}] perguntou no comando /ask: ${question}`;

      const config = readRuntimeConfig(c.env);

      // Iniciar a geração no background (Cloudflare Worker permite exceder 3 segundos aqui)
      c.executionCtx.waitUntil(
        (async () => {
          try {
            console.log(`[Ask] Processando em background a pergunta: ${question}`);
            const channelId = interact.channel?.id || interact.channel_id;
            const aiResponse = await generateBotResponse(
              c.env,
              config,
              userPrompt,
              true,
              channelId,
            );
            console.log(`[Ask] Resposta Gerada (Length): ${aiResponse.length}`);

            // Formatar conteúdo final
            const fullContent = `<@${userId}> \n> **${question}**\n\n${aiResponse}`;

            // O Discord tem um limite rígido de 2000 caracteres por mensagem.
            // Para respostas enormes, limitamos para enviar apenas uma mensagem (até 1950 chars para ter margem)
            const safeContent =
              fullContent.length > 1950 ? fullContent.substring(0, 1950) + "..." : fullContent;

            // Enviar a resposta editando o webhook diferido original
            const patchRes = await ofetch.raw(
              `https://discord.com/api/v10/webhooks/${config.DISCORD_CLIENT_ID}/${interact.token}/messages/@original`,
              {
                method: "PATCH",
                body: { content: safeContent },
              },
            );

            console.log(`[Ask] EditOriginal Status: ${patchRes.status}`);
          } catch (e) {
            console.error("Erro no processamento bg do comando ask", e);
          }
        })(),
      );

      // Responder 5 (AACK / Defer) imediatamente ao Discord
      return c.json({ type: 5 });
    }

    return c.json({
      type: 4,
      data: {
        content: `Comando "${commandName}" não mapeado.`,
      },
    });
  }

  return c.json({
    type: 4,
    data: {
      content: "Tipo de interacao ainda nao suportado.",
    },
  });
}
