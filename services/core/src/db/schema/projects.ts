import { boolean, pgSchema, text, timestamp, uuid, varchar } from "@pand/db";

const coreSchema = pgSchema("core");

export const projects = coreSchema.table("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: varchar("owner_id", { length: 255 }).notNull().default("unclaimed"),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 255 }).notNull().default("#6366f1"),
  icon: varchar("icon", { length: 255 }).notNull().default("folder"),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
