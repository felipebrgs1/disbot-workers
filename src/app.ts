import { Hono } from "hono";
import discordRoutes from "./routes/discord.routes";
import docsRoutes from "./routes/docs.routes";
import systemRoutes from "./routes/system.routes";
import type { AppBindings } from "./types/bindings";

const app = new Hono<{ Bindings: AppBindings }>();

app.route("/", systemRoutes);
app.route("/discord", discordRoutes);
app.route("/docs", docsRoutes);

export type AppType = typeof app;

export default app;
