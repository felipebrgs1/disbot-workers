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
    const MAX_BATCH_GEMINI = 100;
    for (let i = 0; i < messagesArray.length; i += MAX_BATCH_GEMINI) {
      const batchMessages = messagesArray.slice(i, i + MAX_BATCH_GEMINI);
      const contents = batchMessages.map(msg => `[Membro: ${msg.authorUsername}]: ${msg.content || ""}`);

      const response = await ai.models.embedContent({
        model: "models/gemini-embedding-001",
        contents,
        config: { outputDimensionality: 768 },
      });

      const embeddings = response.embeddings;
      if (embeddings && embeddings.length > 0) {
        const vectorsToInsert = batchMessages.map((msg, index) => {
          const values = embeddings[index]?.values;
          if (!values) return null;
          return {
            id: msg.id,
            values,
            namespace: msg.channelId,
            metadata: {
              authorUsername: msg.authorUsername,
              content: msg.content,
            },
          };
        }).filter(v => v !== null) as any[];

        if (vectorsToInsert.length > 0) {
          console.log(`[Vectorize] Salvando ${vectorsToInsert.length} memórias no namespace ${batchMessages[0].channelId}. Dim: ${vectorsToInsert[0].values.length}`);
          await env.VECTORIZE.upsert(vectorsToInsert);
          console.log(`[Vectorize] Salvas ${vectorsToInsert.length} memórias! (Chunk ${i / MAX_BATCH_GEMINI + 1})`);
        }
      }
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
      model: "models/gemini-embedding-001",
      contents: userPrompt,
      config: { outputDimensionality: 768 },
    });

    const searchVector = embeddingRes.embeddings?.[0]?.values;

    const targetNamespace = channelId || config.DISCORD_CHANNEL_ID;

    // 3. Buscar as 10 memórias matemáticas mais relevantes no Vectorize (filtradas pelo namespace do Canal atual)
    if (searchVector && targetNamespace) {
      console.log(`[Vectorize] Buscando memórias no namespace: ${targetNamespace}. Query dim: ${searchVector.length}`);
      const queryResult = await env.VECTORIZE.query(searchVector, {
        topK: 10,
        namespace: targetNamespace,
        returnMetadata: "all",
      });

      if (queryResult.matches && queryResult.matches.length > 0) {
        vectorMatches = queryResult.matches;
        console.log(`[Vectorize] Encontradas ${vectorMatches.length} memórias relevantes!`);
      } else {
        console.log(`[Vectorize] Nenhuma memória encontrada no namespace ${targetNamespace}.`);
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
      model: "models/gemini-3-flash-preview", // Pode usar "gemini-2.5-flash" se preferir a estabilidade
      contents: [{ role: "user", parts: [{ text: promptText }] }],
      config: isAskCommand ? {} : {},
    });

    return response.text ?? "Fiquei sem palavras! 🤐";
  } catch (error) {
    console.error("Erro no Gemini:", error);
    return "Deu pane no meu sistema, rapaziada! 🤖🔥";
  }
}
