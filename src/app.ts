import { Hono } from "hono";
import discordRoutes from "@routes/discord";
import docsRoutes from "@routes/docs";
import systemRoutes from "@routes/system";
import type { AppBindings } from "@appTypes/bindings";

const app = new Hono<{ Bindings: AppBindings }>();

app.route("/", systemRoutes);
app.route("/discord", discordRoutes);
app.route("/docs", docsRoutes);

export type AppType = typeof app;

export default app;
