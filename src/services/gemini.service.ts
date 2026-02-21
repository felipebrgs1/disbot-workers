import { GoogleGenAI } from "@google/genai";
import { desc } from "drizzle-orm";
import type { RuntimeConfig } from "../config";
import { createDb } from "../db/client";
import { messages } from "../db/schema";
import type { AppBindings } from "../types/bindings";

export async function generateBotResponse(
  env: AppBindings,
  config: RuntimeConfig,
  userPrompt: string,
): Promise<string> {
  const db = createDb(env.DB);

  // 1. Resgatar as últimas 50 mensagens do banco para contexto
  const historyRows = await db.select().from(messages).orderBy(desc(messages.timestamp)).limit(50);

  // Reverter a ordem para ficar cronológica (mais antiga -> mais nova)
  historyRows.reverse();

  // 2. Montar o texto do histórico
  const chatContext = historyRows.map((m) => `[${m.authorUsername}]: ${m.content}`).join("\n");

  // 3. Inicializar o Gemini API
  const ai = new GoogleGenAI({ apiKey: config.GEMINI_API_KEY });

  const systemPrompt = `Você é um membro engraçado de um grupo de amigos no Discord (chamado "El Matadore"). 
Não aja como um assistente de IA engessado. Leia o contexto abaixo do que o pessoal estava falando e dê uma resposta direta, sem rodeios e natural.
    
--- HISTÓRICO RECENTE DO CHAT ---
${chatContext}
---------------------------------

Use esse contexto se fizer sentido. Agora responda a última mensagem (onde mencionaram você)!`;

  const promptText = `${systemPrompt}\n\nNova marcação para você responder:\n${userPrompt}`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: promptText }] }],
    });

    // O texto gerado pela IA
    return response.text ?? "Fiquei sem palavras! 🤐";
  } catch (error) {
    console.error("Erro no Gemini:", error);
    return "Deu pane no meu sistema, rapaziada! 🤖🔥";
  }
}
