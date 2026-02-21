import app from "./app";
import { syncDiscordMessages } from "./services/cron.service";
import type { AppBindings } from "./types/bindings";

export default {
  fetch: app.fetch,
  async scheduled(event: ScheduledEvent, env: AppBindings, ctx: ExecutionContext) {
    ctx.waitUntil(syncDiscordMessages(env));
  },
};
