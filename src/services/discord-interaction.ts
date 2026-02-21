import { verifyKey } from "discord-interactions";
import { z } from "zod";

const discordInteractionSchema = z
  .object({
    id: z.string(),
    type: z.number(),
    data: z
      .object({
        name: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type DiscordInteraction = z.infer<typeof discordInteractionSchema>;

type VerifyDiscordRequestInput = {
  rawBody: string;
  signature: string;
  timestamp: string;
  publicKey: string;
};

type ParseDiscordInteractionResult =
  | { success: true; data: DiscordInteraction }
  | { success: false; error: "invalid_json_body" | "invalid_discord_interaction" };

export async function verifyDiscordRequest(input: VerifyDiscordRequestInput) {
  return verifyKey(input.rawBody, input.signature, input.timestamp, input.publicKey);
}

export function parseDiscordInteraction(rawBody: string): ParseDiscordInteractionResult {
  const parsedBody = safeJsonParse(rawBody);
  if (!parsedBody.success) {
    return { success: false, error: "invalid_json_body" };
  }

  const interaction = discordInteractionSchema.safeParse(parsedBody.data);
  if (!interaction.success) {
    return { success: false, error: "invalid_discord_interaction" };
  }

  return { success: true, data: interaction.data };
}

function safeJsonParse(input: string): { success: true; data: unknown } | { success: false } {
  try {
    return { success: true, data: JSON.parse(input) };
  } catch {
    return { success: false };
  }
}
