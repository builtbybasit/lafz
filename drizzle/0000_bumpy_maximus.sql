CREATE TABLE `packs` (
	`id` integer PRIMARY KEY NOT NULL,
	`level` text NOT NULL,
	`index` integer NOT NULL,
	`title` text NOT NULL,
	`stars` integer DEFAULT 0 NOT NULL,
	`best` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profile` (
	`id` integer PRIMARY KEY NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`streak` integer DEFAULT 0 NOT NULL,
	`last_played` text
);
--> statement-breakpoint
CREATE TABLE `words` (
	`id` integer PRIMARY KEY NOT NULL,
	`word` text NOT NULL,
	`ipa` text NOT NULL,
	`pos` text NOT NULL,
	`gram` text NOT NULL,
	`level` text NOT NULL,
	`ur` text NOT NULL,
	`senses` text NOT NULL,
	`forms` text DEFAULT '[]' NOT NULL,
	`pack_id` integer NOT NULL,
	`box` integer DEFAULT 0 NOT NULL,
	`due` text,
	FOREIGN KEY (`pack_id`) REFERENCES `packs`(`id`) ON UPDATE no action ON DELETE no action
);
