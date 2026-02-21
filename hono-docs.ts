import { defineConfig } from "@rcmade/hono-docs";

export default defineConfig({
	tsConfigPath: "./tsconfig.json",
	openApi: {
		openapi: "3.0.0",
		info: {
			title: "Muddy Sunset API",
			version: "0.1.0",
		},
		servers: [
			{
				url: "http://localhost:8787",
			},
		],
	},
	outputs: {
		openApiJson: "./openapi/openapi.json",
	},
	apis: [
		{
			name: "System",
			apiPrefix: "",
			appTypePath: "src/routes/system.routes.ts",
			api: [
				{
					api: "/",
					method: "get",
					summary: "API status",
					description: "Retorna status basico da API em Cloudflare Workers.",
				},
				{
					api: "/health",
					method: "get",
					summary: "Health check",
					description: "Endpoint de health check da aplicacao.",
				},
			],
		},
		{
			name: "Discord",
			apiPrefix: "/discord",
			appTypePath: "src/routes/discord.routes.ts",
			api: [
				{
					api: "/interactions",
					method: "post",
					summary: "Discord interactions",
					description: "Recebe interacoes assinadas do Discord.",
				},
			],
		},
		{
			name: "Documentation",
			apiPrefix: "/docs",
			appTypePath: "src/routes/docs.routes.ts",
			api: [
				{
					api: "/",
					method: "get",
					summary: "API docs UI",
					description: "Interface visual da documentacao OpenAPI.",
				},
				{
					api: "/openapi",
					method: "get",
					summary: "OpenAPI JSON",
					description: "Documento OpenAPI gerado automaticamente.",
				},
			],
		},
	],
});
