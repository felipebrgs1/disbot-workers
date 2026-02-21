import app from "./app";
import { syncDiscordMessages } from "./services/cron.service";
import type { AppBindings } from "./types/bindings";

export default {
  async fetch(request: Request, env: AppBindings, ctx: ExecutionContext) {
    const url = new URL(request.url);
    if (url.pathname === "/force-cron") {
      ctx.waitUntil(syncDiscordMessages(env));
      return new Response("Cron job disparado manualmente!", { status: 200 });
    }
    return app.fetch(request, env, ctx);
  },
  async scheduled(event: ScheduledEvent, env: AppBindings, ctx: ExecutionContext) {
    ctx.waitUntil(syncDiscordMessages(env));
  },
};
