CREATE SCHEMA IF NOT EXISTS "core";
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "core"."projects" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(255) NOT NULL,
  "description" text,
  "color" varchar(255) DEFAULT '#6366f1' NOT NULL,
  "icon" varchar(255) DEFAULT 'folder' NOT NULL,
  "archived" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "core"."todos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "project_id" uuid,
  "title" varchar(255) NOT NULL,
  "description" text,
  "status" varchar(64) DEFAULT 'todo' NOT NULL,
  "priority" varchar(64) DEFAULT 'medium' NOT NULL,
  "due_date" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
