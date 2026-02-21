import type { Context } from "hono";
import { createDb } from "../db/client";
import type { AppBindings } from "../types/bindings";

type AppContext = Context<{ Bindings: AppBindings }>;

export function getRoot(c: AppContext) {
  return c.json({
    name: "muddy-sunset-04c3",
    status: "ok",
    runtime: "cloudflare-workers",
    architecture: "mvc",
  });
}

export async function getHealth(c: AppContext) {
  void createDb(c.env.DB);
  return c.json({
    ok: true,
    timestamp: new Date().toISOString(),
  });
}
