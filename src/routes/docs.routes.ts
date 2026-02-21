import { apiReference } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import openApiDocument from "../../openapi/openapi.json";
import type { AppBindings } from "../types/bindings";

const docsRoutes = new Hono<{ Bindings: AppBindings }>()
	.get(
		"/",
		apiReference({
			spec: {
				url: "/docs/openapi",
			},
		}),
	)
	.get("/openapi", (c) => {
		return c.json(openApiDocument);
	});

export type AppType = typeof docsRoutes;

export default docsRoutes;
