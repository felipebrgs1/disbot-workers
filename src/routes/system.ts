import { Hono } from "hono";
import { getHealth, getRoot } from "@controllers/system";
import type { AppBindings } from "@appTypes/bindings";

const systemRoutes = new Hono<{ Bindings: AppBindings }>()
  .get("/", getRoot)
  .get("/health", getHealth);

export type AppType = typeof systemRoutes;

export default systemRoutes;
