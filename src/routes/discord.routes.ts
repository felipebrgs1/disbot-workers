import { Hono } from "hono";
import { handleDiscordInteraction } from "../controllers/discord.controller";
import type { AppBindings } from "../types/bindings";

const discordRoutes = new Hono<{ Bindings: AppBindings }>().post(
  "/interactions",
  handleDiscordInteraction,
);

export type AppType = typeof discordRoutes;

export default discordRoutes;
