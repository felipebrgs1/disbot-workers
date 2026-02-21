CREATE TABLE `discord_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`interaction_id` text NOT NULL,
	`command_name` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `discord_events_interaction_id_unique` ON `discord_events` (`interaction_id`);--> statement-breakpoint
CREATE TABLE `bot_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`channel_id` text NOT NULL,
	`author_id` text NOT NULL,
	`author_username` text NOT NULL,
	`content` text NOT NULL,
	`timestamp` text NOT NULL
);
