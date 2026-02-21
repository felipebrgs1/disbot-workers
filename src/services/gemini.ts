import { GoogleGenAI } from "@google/genai";
import { desc, eq } from "drizzle-orm";
import type { RuntimeConfig } from "@config";
import { createDb } from "@db/client";
import { messages } from "@db/schema";
import type { AppBindings } from "@appTypes/bindings";

export async function embedAndStoreMessages(
  env: AppBindings,
  config: RuntimeConfig,
  messagesArray: { id: string; channelId: string; authorUsername: string; content: string }[],
) {
  if (messagesArray.length === 0) return;
  const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

  try {
    const vectorsToInsert = [];

    for (const msg of messagesArray) {
      if (!msg.content) continue;

      const response = await ai.models.embedContent({
        model: "text-embedding-004",
        contents: `[Membro: ${msg.authorUsername}]: ${msg.content}`,
      });

      const values = response.embeddings?.[0]?.values;
      if (values) {
        vectorsToInsert.push({
          id: msg.id,
          values,
          namespace: msg.channelId, // Namespace para isolar bancos por servidor/canal
          metadata: {
            authorUsername: msg.authorUsername,
            content: msg.content,
          },
        });
      }
    }

    if (vectorsToInsert.length > 0) {
      // Divide inserção por limites (Upsert aceita muitos, mas é bom prevenir)
      const MAX_BATCH = 100;
      for (let i = 0; i < vectorsToInsert.length; i += MAX_BATCH) {
        const batch = vectorsToInsert.slice(i, i + MAX_BATCH);

        // ENV.VECTORIZE.upsert() garante que as mensagens nunca se multipliquem. 
        // Como o ID da inserção é o ID oficial da mensagem do Discord (msg.id), 
        // se a mensagem já existir lá, o Vectorize apenas atualiza e ignora a duplicação!
        await env.VECTORIZE.upsert(batch);
      }
      console.log(`[Vectorize] Salvos ${vectorsToInsert.length} memórias de longo prazo!`);
    }
  } catch (err) {
    console.error(`[Vectorize] Erro ao incorporar:`, err);
  }
}

export async function generateBotResponse(
  env: AppBindings,
  config: RuntimeConfig,
  userPrompt: string,
  isAskCommand: boolean = false,
  channelId?: string,
): Promise<string> {
  // 1. Inicializar o Gemini API
  const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

  // 2. Criar Embedding da Pergunta Atual para Busca (RAG)
  let vectorMatches: Array<any> = [];
  let chatContext = "Nenhum histórico passado recente com esse assunto...";

  try {
    const embeddingRes = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: userPrompt,
    });

    const searchVector = embeddingRes.embeddings?.[0]?.values;

    // 3. Buscar as 10 memórias matemáticas mais relevantes no Vectorize (filtradas pelo namespace do Canal atual)
    if (searchVector && channelId) {
      const queryResult = await env.VECTORIZE.query(searchVector, {
        topK: 10,
        namespace: channelId,
        returnMetadata: "all",
      });

      if (queryResult.matches && queryResult.matches.length > 0) {
        vectorMatches = queryResult.matches;
      }
    } else if (searchVector && config.DISCORD_CHANNEL_ID) {
      const queryResult = await env.VECTORIZE.query(searchVector, {
        topK: 10,
        namespace: config.DISCORD_CHANNEL_ID,
        returnMetadata: "all",
      });

      if (queryResult.matches && queryResult.matches.length > 0) {
        vectorMatches = queryResult.matches;
      }
    }

    if (vectorMatches.length > 0) {
      chatContext = vectorMatches
        .map((m) => `[${m.metadata?.authorUsername}]: ${m.metadata?.content}`)
        .join("\n");
    }
  } catch (err) {
    console.error("[Vectorize] Falha na busca por RAG:", err);
  }

  const systemPrompt = isAskCommand
    ? `Você é o "El Matadore", um membro de um grupo de amigos no Discord que acabou de ser invocado com o comando /ask para responder a uma pergunta de forma aprofundada.
Leia as Memórias Relevantes passadas (recuperadas via busca semântica) para entender se vocês já debateram isso antes ou pegar contextos valiosos. Dê uma resposta COMPLETA, PROFUNDA e TÉCNICA (se for o caso), NÃO limite seu conhecimento ou resposta de "thinking". No entanto, aja naturalmente como membro da turma, misturando genialidade técnica com a zoeira e o tom do grupo.
    
--- MEMÓRIAS RELEVANTES DO CHAT ---
${chatContext}
---------------------------------

Responda a pergunta do usuário a seguir com toda a sua capacidade:`
    : `Você é um membro engraçado de um grupo de amigos no Discord (chamado "El Matadore"). 
Não aja como um assistente de IA engessado. Abaixo estão algumas Memórias Relevantes e semelhantes do grupo que a Busca Semântica encontrou. Dê uma resposta direta, sem rodeios e natural.
    
--- MEMÓRIAS RELEVANTES DO CHAT ---
${chatContext}
---------------------------------

Use esse contexto se fizer sentido. Agora responda a última mensagem (onde mencionaram você)!`;

  const promptText = `${systemPrompt}\n\nNova marcação/pergunta para você responder:\n${userPrompt}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview", // Pode usar "gemini-2.5-flash" se preferir a estabilidade
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      config: isAskCommand ? {} : {},
    });

    return response.text ?? "Fiquei sem palavras! 🤐";
  } catch (error) {
    console.error("Erro no Gemini:", error);
    return "Deu pane no meu sistema, rapaziada! 🤖🔥";
  }
}
