import { apiReference } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import openApiDocument from "../../openapi/openapi.json";
import type { AppBindings } from "@appTypes/bindings";

const docsRoutes = new Hono<{ Bindings: AppBindings }>()
  .get(
    "/",
    apiReference({
      url: "/docs/openapi",
    }),
  )
  .get("/openapi", (c) => {
    return c.json(openApiDocument, 200, {
      "cache-control": "no-store",
    });
  });

export type AppType = typeof docsRoutes;

export default docsRoutes;
