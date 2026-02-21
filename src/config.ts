import { z } from "zod";

const runtimeConfigSchema = z.object({
  DISCORD_PUBLIC_KEY: z.string().min(1, "DISCORD_PUBLIC_KEY is required"),
  DISCORD_BOT_TOKEN: z.string().min(1, "DISCORD_BOT_TOKEN is required"),
  DISCORD_CHANNEL_ID: z.string().optional(),
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  DISCORD_CLIENT_ID: z.string().min(1, "DISCORD_CLIENT_ID is required"),
});

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

type RuntimeEnv = {
  DISCORD_PUBLIC_KEY: string;
  DISCORD_BOT_TOKEN: string;
  DISCORD_CHANNEL_ID?: string;
  GEMINI_API_KEY: string;
  DISCORD_CLIENT_ID: string;
};

export function readRuntimeConfig(env: RuntimeEnv): RuntimeConfig {
  return runtimeConfigSchema.parse({
    DISCORD_PUBLIC_KEY: env.DISCORD_PUBLIC_KEY,
    DISCORD_BOT_TOKEN: env.DISCORD_BOT_TOKEN,
    DISCORD_CHANNEL_ID: env.DISCORD_CHANNEL_ID,
    GEMINI_API_KEY: env.GEMINI_API_KEY,
    DISCORD_CLIENT_ID: env.DISCORD_CLIENT_ID,
  });
}
