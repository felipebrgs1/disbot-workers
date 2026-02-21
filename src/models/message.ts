import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(), // Discord Message ID
  channelId: text("channel_id").notNull(),
  authorId: text("author_id").notNull(),
  authorUsername: text("author_username").notNull(),
  content: text("content").notNull(),
  timestamp: text("timestamp").notNull(),
});
