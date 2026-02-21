import type { Context } from "hono";
import { readRuntimeConfig } from "../config";
import { createDb } from "../db/client";
import { saveDiscordEvent } from "../models/discord-event.model";
import {
	parseDiscordInteraction,
	verifyDiscordRequest,
} from "../services/discord-interaction.service";
import type { AppBindings } from "../types/bindings";

type AppContext = Context<{ Bindings: AppBindings }>;

export async function handleDiscordInteraction(c: AppContext) {
	const signature = c.req.header("x-signature-ed25519");
	const timestamp = c.req.header("x-signature-timestamp");
	if (!signature || !timestamp) {
		return c.json({ error: "missing_discord_signature_headers" }, 401);
	}

	const rawBody = await c.req.text();
	const { DISCORD_PUBLIC_KEY } = readRuntimeConfig(c.env);
	const isValidRequest = await verifyDiscordRequest({
		rawBody,
		signature,
		timestamp,
		publicKey: DISCORD_PUBLIC_KEY,
	});
	if (!isValidRequest) {
		return c.json({ error: "invalid_discord_signature" }, 401);
	}

	const interactionResult = parseDiscordInteraction(rawBody);
	if (!interactionResult.success) {
		return c.json({ error: interactionResult.error }, 400);
	}

	const interaction = interactionResult.data;
	if (interaction.type === 1) {
		return c.json({ type: 1 });
	}

	if (interaction.type === 2) {
		const commandName = interaction.data?.name ?? "unknown";
		const db = createDb(c.env.DB);

		try {
			await saveDiscordEvent(db, {
				interactionId: interaction.id,
				commandName,
			});
		} catch (error) {
			console.warn("Could not persist discord event", error);
		}

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
}
