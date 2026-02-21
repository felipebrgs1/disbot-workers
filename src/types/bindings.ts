import type { D1Database, KVNamespace, VectorizeIndex } from "@cloudflare/workers-types";

export type AppBindings = {
  DB: D1Database;
  DISCORD_PUBLIC_KEY: string;
  DISCORD_BOT_TOKEN: string;
  DISCORD_CHANNEL_ID: string;
  GEMINI_API_KEY: string;
  DISCORD_CLIENT_ID: string;
  discbot: KVNamespace;
  VECTORIZE: VectorizeIndex;
};
