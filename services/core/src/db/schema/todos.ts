import { pgSchema, text, timestamp, uuid, varchar } from "@pand/db";

const coreSchema = pgSchema("core");

export const todos = coreSchema.table("todos", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: varchar("owner_id", { length: 255 }).notNull().default("unclaimed"),
  projectId: uuid("project_id"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  status: varchar("status", { length: 64 }).notNull().default("todo"),
  priority: varchar("priority", { length: 64 }).notNull().default("medium"),
  dueDate: timestamp("due_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
