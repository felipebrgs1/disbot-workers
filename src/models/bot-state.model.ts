import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const botState = sqliteTable("bot_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
