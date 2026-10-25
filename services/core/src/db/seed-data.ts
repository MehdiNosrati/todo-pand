import { eq } from "@pand/db";
import type { CoreDbInstance } from "./index.js";
import { projects } from "./schema/projects.js";
import { todos } from "./schema/todos.js";

export interface SeedResult {
  seeded: boolean;
  projectsCreated: number;
  todosCreated: number;
}

export async function seedWorkspaceData(
  db: CoreDbInstance["db"],
  options: { ownerId?: string; force?: boolean } = {},
): Promise<SeedResult> {
  const ownerId = options.ownerId ?? "demo-seed";

  const existingProjects = await db
    .select()
    .from(projects)
    .where(eq(projects.ownerId, ownerId))
    .limit(1);
  const existingTodos = await db.select().from(todos).where(eq(todos.ownerId, ownerId)).limit(1);

  if (!options.force && (existingProjects.length > 0 || existingTodos.length > 0)) {
    return {
      seeded: false,
      projectsCreated: 0,
      todosCreated: 0,
    };
  }

  if (options.force) {
    await db.delete(todos).where(eq(todos.ownerId, ownerId));
    await db.delete(projects).where(eq(projects.ownerId, ownerId));
  }

  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;

  const insertedProjects = await db
    .insert(projects)
    .values([
      {
        ownerId,
        name: "Product Launch",
        description: "Go-to-market milestones, release notes, and launch readiness checklist",
        color: "#6366f1",
        icon: "rocket",
        archived: false,
      },
      {
        ownerId,
        name: "Engineering Sprint",
        description: "Core platform architecture, API contracts, and reliability improvements",
        color: "#0ea5e9",
        icon: "code",
        archived: false,
      },
      {
        ownerId,
        name: "Personal & Errands",
        description: "Daily life tasks, reading list, and personal reminders",
        color: "#10b981",
        icon: "check-circle",
        archived: false,
      },
    ])
    .returning();

  const launchProject = insertedProjects[0];
  const engProject = insertedProjects[1];
  const personalProject = insertedProjects[2];

  const insertedTodos = await db
    .insert(todos)
    .values([
      {
        ownerId,
        projectId: launchProject?.id ?? null,
        title: "Finalize Q4 product launch announcement post",
        description: "Coordinate copy review with design and engineering before publishing.",
        status: "in_progress",
        priority: "urgent",
        dueDate: new Date(now + 1 * dayMs),
      },
      {
        ownerId,
        projectId: launchProject?.id ?? null,
        title: "Record 2-minute interactive product demo video",
        description: "Walk through project creation, Kanban board workflow, and live analytics.",
        status: "todo",
        priority: "high",
        dueDate: new Date(now + 2 * dayMs),
      },
      {
        ownerId,
        projectId: launchProject?.id ?? null,
        title: "Approve production domain & SSL certificates",
        description: "Verified edge routing and TLS certificates on Pand Box.",
        status: "done",
        priority: "high",
        dueDate: new Date(now - 2 * dayMs),
      },
      {
        ownerId,
        projectId: engProject?.id ?? null,
        title: "Generate OpenAPI 3.1 contract and TypeScript SDK",
        description:
          "Ensure all custom stats and bulk action endpoints are reflected in @todo-pand/sdk.",
        status: "done",
        priority: "urgent",
        dueDate: new Date(now - 1 * dayMs),
      },
      {
        ownerId,
        projectId: engProject?.id ?? null,
        title: "Audit overdue task alerts and query indexes",
        description: "Verify fast filtering by project, status, and priority on the todos table.",
        status: "in_progress",
        priority: "medium",
        dueDate: new Date(now - 1 * dayMs),
      },
      {
        ownerId,
        projectId: engProject?.id ?? null,
        title: "Add end-to-end Vitest coverage for bulk operations",
        description: "Test bulk mark-done, clear-completed, and workspace stats aggregation.",
        status: "todo",
        priority: "high",
        dueDate: new Date(now + 3 * dayMs),
      },
      {
        ownerId,
        projectId: personalProject?.id ?? null,
        title: "Book dentist appointment and annual checkup",
        description: "Call clinic before Friday afternoon.",
        status: "todo",
        priority: "medium",
        dueDate: new Date(now + 4 * dayMs),
      },
      {
        ownerId,
        projectId: personalProject?.id ?? null,
        title: "Order espresso beans and desk lamp",
        description: "Picked up medium roast beans from local roaster.",
        status: "done",
        priority: "low",
        dueDate: new Date(now - 3 * dayMs),
      },
    ])
    .returning();

  return {
    seeded: true,
    projectsCreated: insertedProjects.length,
    todosCreated: insertedTodos.length,
  };
}
