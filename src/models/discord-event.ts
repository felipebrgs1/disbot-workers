import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { createDb } from "@db/client";

export const discordEvents = sqliteTable("discord_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  interactionId: text("interaction_id").notNull().unique(),
  commandName: text("command_name"),
  createdAt: text("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

type SaveDiscordEventInput = {
  interactionId: string;
  commandName: string;
};

type DbClient = ReturnType<typeof createDb>;

export async function saveDiscordEvent(db: DbClient, input: SaveDiscordEventInput) {
  await db.insert(discordEvents).values({
    interactionId: input.interactionId,
    commandName: input.commandName,
  });
}
