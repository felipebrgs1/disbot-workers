import { Hono } from "hono";
import { getHealth, getRoot } from "../controllers/system.controller";
import type { AppBindings } from "../types/bindings";

const systemRoutes = new Hono<{ Bindings: AppBindings }>();

systemRoutes.get("/", getRoot);
systemRoutes.get("/health", getHealth);

export type AppType = typeof systemRoutes;

export default systemRoutes;
