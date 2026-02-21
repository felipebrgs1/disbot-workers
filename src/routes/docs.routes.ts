import { Hono } from "hono";
import openApiDocument from "../../openapi/openapi.json";
import type { AppBindings } from "../types/bindings";

const docsRoutes = new Hono<{ Bindings: AppBindings }>();

docsRoutes.get("/", (c) => {
	return c.html(`<!doctype html>
<html>
	<head>
		<meta charset="utf-8" />
		<title>Muddy Sunset API Docs</title>
	</head>
	<body>
		<h1>Muddy Sunset API Docs</h1>
		<p>OpenAPI JSON disponivel em <a href="/docs/openapi">/docs/openapi</a>.</p>
	</body>
</html>`);
});

docsRoutes.get("/openapi", (c) => {
	return c.json(openApiDocument);
});

export type AppType = typeof docsRoutes;

export default docsRoutes;
