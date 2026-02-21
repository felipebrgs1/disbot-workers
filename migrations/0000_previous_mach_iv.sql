
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
