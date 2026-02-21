import { verifyKey } from "discord-interactions";
import { Hono } from "hono";
import { z } from "zod";
import { readRuntimeConfig } from "./config";
import { createDb } from "./db/client";

type Bindings = {
	DB: D1Database;
	DISCORD_PUBLIC_KEY: string;
};

const discordInteractionSchema = z
	.object({
		type: z.number(),
		data: z
			.object({
				name: z.string().optional(),
			})
			.passthrough()
			.optional(),
	})
	.passthrough();

const app = new Hono<{ Bindings: Bindings }>();

app.get("/", (c) => {
	return c.json({
		name: "muddy-sunset-04c3",
		status: "ok",
		runtime: "cloudflare-workers",
	});
});

app.get("/health", async (c) => {
	// Keep Drizzle initialized from the start to make future DB features incremental.
	void createDb(c.env.DB);
	return c.json({
		ok: true,
		timestamp: new Date().toISOString(),
	});
});

app.post("/discord/interactions", async (c) => {
	const signature = c.req.header("x-signature-ed25519");
	const timestamp = c.req.header("x-signature-timestamp");
	if (!signature || !timestamp) {
		return c.json({ error: "missing_discord_signature_headers" }, 401);
	}

	const rawBody = await c.req.text();
	const { DISCORD_PUBLIC_KEY } = readRuntimeConfig(c.env);
	const isValidRequest = await verifyKey(rawBody, signature, timestamp, DISCORD_PUBLIC_KEY);
	if (!isValidRequest) {
		return c.json({ error: "invalid_discord_signature" }, 401);
	}

	const parsedJson = safeJsonParse(rawBody);
	if (!parsedJson.success) {
		return c.json({ error: "invalid_json_body" }, 400);
	}

	const interaction = discordInteractionSchema.safeParse(parsedJson.data);
	if (!interaction.success) {
		return c.json({ error: "invalid_discord_interaction" }, 400);
	}

	if (interaction.data.type === 1) {
		return c.json({ type: 1 });
	}

	if (interaction.data.type === 2) {
		const commandName = interaction.data.data?.name ?? "unknown";
		return c.json({
			type: 4,
			data: {
				content: `Comando "${commandName}" recebido. Handler em implementacao.`,
			},
		});
	}

	return c.json({
		type: 4,
		data: {
			content: "Tipo de interacao ainda nao suportado.",
		},
	});
});

function safeJsonParse(input: string): { success: true; data: unknown } | { success: false } {
	try {
		return { success: true, data: JSON.parse(input) };
	} catch {
		return { success: false };
	}
}

export default app;
