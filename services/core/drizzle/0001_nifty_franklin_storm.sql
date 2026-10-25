CREATE SCHEMA IF NOT EXISTS "core";
--> statement-breakpoint
ALTER TABLE "core"."projects" ALTER COLUMN "color" SET DEFAULT '#6366f1';--> statement-breakpoint
ALTER TABLE "core"."projects" ALTER COLUMN "icon" SET DEFAULT 'folder';--> statement-breakpoint
ALTER TABLE "core"."projects" ALTER COLUMN "archived" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "core"."todos" ALTER COLUMN "status" SET DEFAULT 'todo';--> statement-breakpoint
ALTER TABLE "core"."todos" ALTER COLUMN "priority" SET DEFAULT 'medium';