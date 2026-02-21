import { GoogleGenAI } from "@google/genai";
import { desc, eq } from "drizzle-orm";
import type { RuntimeConfig } from "@config";
import { createDb } from "@db/client";
import { messages } from "@db/schema";
import type { AppBindings } from "@appTypes/bindings";

export async function generateBotResponse(
  env: AppBindings,
  config: RuntimeConfig,
  userPrompt: string,
  isAskCommand: boolean = false,
  channelId?: string,
): Promise<string> {
  const db = createDb(env.DB);

  // 1. Resgatar as últimas 100 mensagens do banco para contexto
  let historyQuery = db.select().from(messages).$dynamic();

  if (channelId) {
    historyQuery = historyQuery.where(eq(messages.channelId, channelId));
  } else if (config.DISCORD_CHANNEL_ID) {
    historyQuery = historyQuery.where(eq(messages.channelId, config.DISCORD_CHANNEL_ID));
  }

  const historyRows = await historyQuery.orderBy(desc(messages.timestamp)).limit(150);

  // Reverter a ordem para ficar cronológica (mais antiga -> mais nova)
  historyRows.reverse();

  // 2. Montar o texto do histórico e levantar os 5 membros mais ativos
  const chatContext = historyRows.map((m) => `[${m.authorUsername}]: ${m.content}`).join("\n");

  const userCounts: Record<string, number> = {};
  for (const row of historyRows) {
    userCounts[row.authorUsername] = (userCounts[row.authorUsername] || 0) + 1;
  }

  const topUsers = Object.entries(userCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map((entry) => entry[0]);

  const topUsersContext =
    topUsers.length > 0
      ? `\nREGRA IMPORTANTE: Os 5 membros mais ativos deste canal são: ${topUsers.join(", ")}. Use o contexto para entender a personalidade deles. Sempre que um deles falar com você ou for mencionado, baseie sua interação na personalidade, gírias e jeito de falar que eles demonstraram no histórico!`
      : "";

  // 3. Inicializar o Gemini API
  const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

  const systemPrompt = isAskCommand
    ? `Você é o "El Matadore", um membro de um grupo de amigos no Discord que acabou de ser invocado com o comando /ask para responder a uma pergunta de forma aprofundada.
Leia o contexto abaixo para entender o assunto, a personalidade do grupo e dos amigos. Dê uma resposta COMPLETA, PROFUNDA e TÉCNICA (se for o caso), NÃO limite seu conhecimento ou resposta de "thinking". No entanto, aja naturalmente como membro da turma, misturando genialidade técnica com a zoeira e o tom do grupo.${topUsersContext}
    
--- HISTÓRICO RECENTE DO CHAT ---
${chatContext}
---------------------------------

Responda a pergunta do usuário a seguir com toda a sua capacidade:`
    : `Você é um membro engraçado de um grupo de amigos no Discord (chamado "El Matadore"). 
Não aja como um assistente de IA engessado. Leia o contexto abaixo do que o pessoal estava falando e dê uma resposta direta, sem rodeios e natural.${topUsersContext}
    
--- HISTÓRICO RECENTE DO CHAT ---
${chatContext}
---------------------------------

Use esse contexto se fizer sentido. Agora responda a última mensagem (onde mencionaram você)!`;

  const promptText = `${systemPrompt}\n\nNova marcação para você responder:\n${userPrompt}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      config: isAskCommand
        ? {
          // Remove restrições de pensamento/extensão do bot se for Ask
        }
        : {},
    });

    // O texto gerado pela IA
    return response.text ?? "Fiquei sem palavras! 🤐";
  } catch (error) {
    console.error("Erro no Gemini:", error);
    return "Deu pane no meu sistema, rapaziada! 🤖🔥";
  }
}
