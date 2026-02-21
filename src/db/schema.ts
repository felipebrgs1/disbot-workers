import { sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const discordEvents = sqliteTable("discord_events", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	interactionId: text("interaction_id").notNull().unique(),
	commandName: text("command_name"),
	createdAt: text("created_at")
		.default(sql`CURRENT_TIMESTAMP`)
		.notNull(),
});
