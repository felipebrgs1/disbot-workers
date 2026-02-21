import { Hono } from "hono";
import { getHealth, getRoot } from "../controllers/system.controller";
import type { AppBindings } from "../types/bindings";

const systemRoutes = new Hono<{ Bindings: AppBindings }>()
	.get("/", getRoot)
	.get("/health", getHealth);

export type AppType = typeof systemRoutes;

export default systemRoutes;
