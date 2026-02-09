CREATE TABLE `generations` (
	`id` text PRIMARY KEY NOT NULL,
	`idea` text NOT NULL,
	`text_variations_json` text NOT NULL,
	`images_json` text NOT NULL,
	`selected_text_id` text,
	`selected_image_id` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`image_url` text,
	`scheduled_at` integer,
	`published_at` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`linkedin_post_urn` text,
	`error_message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
