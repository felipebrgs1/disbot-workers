import { Hono } from "hono";
import { handleDiscordInteraction } from "@controllers/discord";
import type { AppBindings } from "@appTypes/bindings";

const discordRoutes = new Hono<{ Bindings: AppBindings }>().post(
  "/interactions",
  handleDiscordInteraction,
);

export type AppType = typeof discordRoutes;

export default discordRoutes;
