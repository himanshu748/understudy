CREATE TABLE `workspace_archives` (
	`workspace_id` text NOT NULL,
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`event_key` text NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`workspace_id`, `kind`, `event_key`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workspace_archives_owner_idx` ON `workspace_archives` (`owner`,`workspace_id`);