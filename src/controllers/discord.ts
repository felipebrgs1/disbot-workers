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
            const aiResponse = await generateBotResponse(c.env, config, userPrompt, true);
            console.log(`[Ask] Resposta Gerada (Length): ${aiResponse.length}`);

            // Formatar conteúdo final
            let fullContent = `<@${userId}> \n> **${question}**\n\n${aiResponse}`;

            // O Discord tem um limite rígido de 2000 caracteres por mensagem.
            // Para respostas enormes do /ask, quebramos em múltiplos balões de até 1900 chars.
            const chunks: string[] = [];
            while (fullContent.length > 0) {
              chunks.push(fullContent.substring(0, 1900));
              fullContent = fullContent.substring(1900);
            }

            // A primeira parte (chunk[0]) precisa editar a resposta vazia "pensando..." do Discord
            const patchRes = await fetch(
              `https://discord.com/api/v10/webhooks/${config.DISCORD_CLIENT_ID}/${interact.token}/messages/@original`,
              {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ content: chunks[0] }),
              },
            );

            console.log(`[Ask] EditOriginal Status: ${patchRes.status}`);
            if (!patchRes.ok) {
              console.error("[Ask] Response:", await patchRes.text());
            }

            // As demais partes são postadas como "follow-up messages" usando o mesmo token do webhook
            for (let i = 1; i < chunks.length; i++) {
              await fetch(
                `https://discord.com/api/v10/webhooks/${config.DISCORD_CLIENT_ID}/${interact.token}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ content: chunks[i] }),
                },
              );
            }
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
