import { and, desc, eq, gt, ilike, inArray, isNull, or } from "@pand/db";
import {
  type AdminEntityMeta,
  OpenAPIHono,
  PandError,
  type ServiceVariables,
  createRoute,
  requireAuth,
  z,
} from "@pand/service";
import type { CoreDbInstance } from "../db/index.js";
import { projects } from "../db/schema/projects.js";
import { todos } from "../db/schema/todos.js";
import { seedWorkspaceData } from "../db/seed-data.js";

type SqlCond = ReturnType<typeof eq>;

export const TodoStatusEnum = z.enum(["todo", "in_progress", "done"]);
export const TodoPriorityEnum = z.enum(["low", "medium", "high", "urgent"]);

export const TodoSchema = z
  .object({
    id: z.string().uuid(),
    ownerId: z.string(),
    projectId: z.string().uuid().nullable(),
    title: z.string().min(1).max(255),
    description: z.string().nullable(),
    status: TodoStatusEnum,
    priority: TodoPriorityEnum,
    dueDate: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("Todo");

export const CreateTodoSchema = z
  .object({
    projectId: z.string().uuid().nullable().optional(),
    title: z.string().min(1).max(255),
    description: z.string().nullable().optional(),
    status: TodoStatusEnum.optional().default("todo"),
    priority: TodoPriorityEnum.optional().default("medium"),
    dueDate: z.string().nullable().optional(),
  })
  .openapi("CreateTodoInput");

export const UpdateTodoSchema = z
  .object({
    projectId: z.string().uuid().nullable().optional(),
    title: z.string().min(1).max(255).optional(),
    description: z.string().nullable().optional(),
    status: TodoStatusEnum.optional(),
    priority: TodoPriorityEnum.optional(),
    dueDate: z.string().nullable().optional(),
  })
  .openapi("UpdateTodoInput");

export const TodoListResponseSchema = z
  .object({
    items: z.array(TodoSchema),
    nextCursor: z.string().nullable(),
  })
  .openapi("TodoListResponse");

export const ProjectStatSummarySchema = z
  .object({
    projectId: z.string().uuid().nullable(),
    projectName: z.string(),
    color: z.string(),
    total: z.number().int(),
    todo: z.number().int(),
    inProgress: z.number().int(),
    done: z.number().int(),
    completionRate: z.number().int(),
  })
  .openapi("ProjectStatSummary");

export const TodoStatsResponseSchema = z
  .object({
    total: z.number().int(),
    byStatus: z.object({
      todo: z.number().int(),
      in_progress: z.number().int(),
      done: z.number().int(),
    }),
    byPriority: z.object({
      low: z.number().int(),
      medium: z.number().int(),
      high: z.number().int(),
      urgent: z.number().int(),
    }),
    overdue: z.number().int(),
    dueToday: z.number().int(),
    completionRate: z.number().int(),
    byProject: z.array(ProjectStatSummarySchema),
  })
  .openapi("TodoStatsResponse");

export const BulkStatusInputSchema = z
  .object({
    status: TodoStatusEnum,
    projectId: z.string().uuid().nullable().optional(),
    ids: z.array(z.string().uuid()).optional(),
  })
  .openapi("BulkStatusInput");

export const BulkStatusResponseSchema = z
  .object({
    updatedCount: z.number().int(),
    status: TodoStatusEnum,
  })
  .openapi("BulkStatusResponse");

export const ClearCompletedInputSchema = z
  .object({
    projectId: z.string().uuid().nullable().optional(),
  })
  .openapi("ClearCompletedInput");

export const ClearCompletedResponseSchema = z
  .object({
    deletedCount: z.number().int(),
  })
  .openapi("ClearCompletedResponse");

export const SeedWorkspaceInputSchema = z
  .object({
    force: z.boolean().optional().default(false),
  })
  .openapi("SeedWorkspaceInput");

export const SeedWorkspaceResponseSchema = z
  .object({
    seeded: z.boolean(),
    projectsCreated: z.number().int(),
    todosCreated: z.number().int(),
  })
  .openapi("SeedWorkspaceResponse");

export const ImportGuestInputSchema = z
  .object({
    onlyIfEmpty: z.boolean().optional().default(true),
    projects: z
      .array(
        z.object({
          localId: z.string(),
          name: z.string().min(1).max(255),
          description: z.string().nullable().optional(),
          color: z.string().min(1).max(255).optional().default("#6366f1"),
          icon: z.string().min(1).max(255).optional().default("folder"),
          archived: z.boolean().optional().default(false),
        }),
      )
      .default([]),
    todos: z
      .array(
        z.object({
          projectId: z.string().nullable().optional(),
          title: z.string().min(1).max(255),
          description: z.string().nullable().optional(),
          status: TodoStatusEnum.optional().default("todo"),
          priority: TodoPriorityEnum.optional().default("medium"),
          dueDate: z.string().nullable().optional(),
        }),
      )
      .default([]),
  })
  .openapi("ImportGuestInput");

export const ImportGuestResponseSchema = z
  .object({
    imported: z.boolean(),
    projectsCreated: z.number().int(),
    todosCreated: z.number().int(),
  })
  .openapi("ImportGuestResponse");

export const todoAdminMeta: AdminEntityMeta = {
  service: "core",
  entity: "Todo",
  table: "todos",
  basePath: "/api/v1/core/todos",
  primaryKey: "id",
  displayField: "title",
  fields: [
    { name: "id", label: "ID", type: "uuid", required: true, readOnly: true },
    { name: "ownerId", label: "Owner ID", type: "string", required: true, readOnly: true },
    {
      name: "projectId",
      label: "Project Id",
      type: "uuid",
      required: false,
      readOnly: false,
    },
    {
      name: "title",
      label: "Title",
      type: "string",
      required: true,
      readOnly: false,
    },
    {
      name: "description",
      label: "Description",
      type: "text",
      required: false,
      readOnly: false,
    },
    {
      name: "status",
      label: "Status",
      type: "enum",
      required: false,
      readOnly: false,
      enumValues: ["todo", "in_progress", "done"],
      defaultValue: "todo",
    },
    {
      name: "priority",
      label: "Priority",
      type: "enum",
      required: false,
      readOnly: false,
      enumValues: ["low", "medium", "high", "urgent"],
      defaultValue: "medium",
    },
    {
      name: "dueDate",
      label: "Due Date",
      type: "datetime",
      required: false,
      readOnly: false,
    },
    { name: "createdAt", label: "Created At", type: "datetime", required: true, readOnly: true },
    { name: "updatedAt", label: "Updated At", type: "datetime", required: true, readOnly: true },
  ],
};

function serializeTodo(row: typeof todos.$inferSelect): z.infer<typeof TodoSchema> {
  return {
    id: row.id,
    ownerId: row.ownerId,
    projectId: row.projectId,
    title: row.title,
    description: row.description,
    status: row.status as z.infer<typeof TodoSchema>["status"],
    priority: row.priority as z.infer<typeof TodoSchema>["priority"],
    dueDate: row.dueDate ? row.dueDate.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createTodosRouter(getDb: () => CoreDbInstance["db"]) {
  const router = new OpenAPIHono<{ Variables: ServiceVariables }>();

  const listRoute = createRoute({
    method: "get",
    path: "/todos",
    middleware: [requireAuth()] as const,
    request: {
      query: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(100),
        cursor: z.string().optional(),
        q: z.string().optional(),
        search: z.string().optional(),
        projectId: z.string().optional(),
        status: TodoStatusEnum.optional(),
        priority: TodoPriorityEnum.optional(),
      }),
    },
    responses: {
      200: {
        description: "List Todos",
        content: {
          "application/json": {
            schema: TodoListResponseSchema,
          },
        },
      },
    },
  });

  router.openapi(listRoute, async (c) => {
    const actor = c.get("actor");
    if (!actor?.sub) {
      throw PandError.unauthorized("Authentication required");
    }
    const { limit, cursor, q, search, projectId, status, priority } = c.req.valid("query");
    const db = getDb();
    const conditions: SqlCond[] = [eq(todos.ownerId, actor.sub)];
    const searchTerm = (q ?? search)?.trim();

    if (searchTerm) {
      const searchCond = or(
        ilike(todos.title, `%${searchTerm}%`),
        ilike(todos.description, `%${searchTerm}%`),
      );
      if (searchCond) {
        conditions.push(searchCond);
      }
    }
    if (projectId) {
      if (projectId === "unassigned") {
        conditions.push(isNull(todos.projectId));
      } else {
        conditions.push(eq(todos.projectId, projectId));
      }
    }
    if (status) {
      conditions.push(eq(todos.status, status));
    }
    if (priority) {
      conditions.push(eq(todos.priority, priority));
    }
    if (cursor) {
      conditions.push(gt(todos.id, cursor));
    }

    let rows = await db
      .select()
      .from(todos)
      .where(and(...conditions))
      .orderBy(desc(todos.createdAt))
      .limit(limit + 1);

    let nextCursor: string | null = null;
    if (rows.length > limit) {
      const popped = rows.pop();
      nextCursor = popped?.id ?? null;
      rows = rows.slice(0, limit);
    }

    return c.json(
      {
        items: rows.map(serializeTodo),
        nextCursor,
      },
      200,
    );
  });

  const statsRoute = createRoute({
    method: "get",
    path: "/todos/stats",
    middleware: [requireAuth()] as const,
    request: {
      query: z.object({
        projectId: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: "Aggregated Todo workspace statistics",
        content: {
          "application/json": {
            schema: TodoStatsResponseSchema,
          },
        },
      },
    },
  });

  router.openapi(statsRoute, async (c) => {
    const actor = c.get("actor");
    if (!actor?.sub) {
      throw PandError.unauthorized("Authentication required");
    }
    const { projectId } = c.req.valid("query");
    const db = getDb();

    const allProjects = await db.select().from(projects).where(eq(projects.ownerId, actor.sub));
    const allTodos = await db.select().from(todos).where(eq(todos.ownerId, actor.sub));

    const scopedTodos = projectId
      ? projectId === "unassigned"
        ? allTodos.filter((t) => t.projectId === null)
        : allTodos.filter((t) => t.projectId === projectId)
      : allTodos;

    const byStatus = {
      todo: 0,
      in_progress: 0,
      done: 0,
    };
    const byPriority = {
      low: 0,
      medium: 0,
      high: 0,
      urgent: 0,
    };

    const now = new Date();
    const todayIsoPrefix = now.toISOString().slice(0, 10);
    let overdue = 0;
    let dueToday = 0;

    for (const item of scopedTodos) {
      if (item.status === "todo" || item.status === "in_progress" || item.status === "done") {
        byStatus[item.status] += 1;
      }
      if (
        item.priority === "low" ||
        item.priority === "medium" ||
        item.priority === "high" ||
        item.priority === "urgent"
      ) {
        byPriority[item.priority] += 1;
      }
      if (item.status !== "done" && item.dueDate) {
        const dueDateIso = item.dueDate.toISOString().slice(0, 10);
        if (dueDateIso === todayIsoPrefix) {
          dueToday += 1;
        } else if (item.dueDate.getTime() < now.getTime()) {
          overdue += 1;
        }
      }
    }

    const total = scopedTodos.length;
    const completionRate = total > 0 ? Math.round((byStatus.done / total) * 100) : 0;

    const projectMap = new Map<
      string | null,
      {
        projectId: string | null;
        projectName: string;
        color: string;
        total: number;
        todo: number;
        inProgress: number;
        done: number;
      }
    >();

    for (const p of allProjects) {
      projectMap.set(p.id, {
        projectId: p.id,
        projectName: p.name,
        color: p.color,
        total: 0,
        todo: 0,
        inProgress: 0,
        done: 0,
      });
    }

    for (const t of allTodos) {
      const key = t.projectId && projectMap.has(t.projectId) ? t.projectId : null;
      if (!projectMap.has(key)) {
        projectMap.set(null, {
          projectId: null,
          projectName: "Inbox / Unassigned",
          color: "#64748b",
          total: 0,
          todo: 0,
          inProgress: 0,
          done: 0,
        });
      }
      const entry = projectMap.get(key);
      if (entry) {
        entry.total += 1;
        if (t.status === "todo") entry.todo += 1;
        else if (t.status === "in_progress") entry.inProgress += 1;
        else if (t.status === "done") entry.done += 1;
      }
    }

    const byProject = Array.from(projectMap.values()).map((entry) => ({
      ...entry,
      completionRate: entry.total > 0 ? Math.round((entry.done / entry.total) * 100) : 0,
    }));

    return c.json(
      {
        total,
        byStatus,
        byPriority,
        overdue,
        dueToday,
        completionRate,
        byProject,
      },
      200,
    );
  });

  const bulkStatusRoute = createRoute({
    method: "post",
    path: "/todos/bulk-status",
    middleware: [requireAuth()] as const,
    request: {
      body: {
        content: {
          "application/json": {
            schema: BulkStatusInputSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Bulk update Todo status",
        content: {
          "application/json": {
            schema: BulkStatusResponseSchema,
          },
        },
      },
    },
  });

  router.openapi(bulkStatusRoute, async (c) => {
    const actor = c.get("actor");
    if (!actor?.sub) {
      throw PandError.unauthorized("Authentication required");
    }
    const input = c.req.valid("json");
    const db = getDb();
    const conditions: SqlCond[] = [eq(todos.ownerId, actor.sub)];

    if (input.ids && input.ids.length > 0) {
      conditions.push(inArray(todos.id, input.ids));
    }
    if (input.projectId !== undefined) {
      if (input.projectId === null) {
        conditions.push(isNull(todos.projectId));
      } else {
        conditions.push(eq(todos.projectId, input.projectId));
      }
    }

    const updated = await db
      .update(todos)
      .set({ status: input.status, updatedAt: new Date() })
      .where(and(...conditions))
      .returning();

    return c.json(
      {
        updatedCount: updated.length,
        status: input.status,
      },
      200,
    );
  });

  const clearCompletedRoute = createRoute({
    method: "post",
    path: "/todos/clear-completed",
    middleware: [requireAuth()] as const,
    request: {
      body: {
        content: {
          "application/json": {
            schema: ClearCompletedInputSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Delete completed Todos",
        content: {
          "application/json": {
            schema: ClearCompletedResponseSchema,
          },
        },
      },
    },
  });

  router.openapi(clearCompletedRoute, async (c) => {
    const actor = c.get("actor");
    if (!actor?.sub) {
      throw PandError.unauthorized("Authentication required");
    }
    const input = c.req.valid("json");
    const db = getDb();
    const conditions: SqlCond[] = [eq(todos.ownerId, actor.sub), eq(todos.status, "done")];

    if (input.projectId !== undefined) {
      if (input.projectId === null) {
        conditions.push(isNull(todos.projectId));
      } else {
        conditions.push(eq(todos.projectId, input.projectId));
      }
    }

    const deleted = await db
      .delete(todos)
      .where(and(...conditions))
      .returning();

    return c.json(
      {
        deletedCount: deleted.length,
      },
      200,
    );
  });

  const seedRoute = createRoute({
    method: "post",
    path: "/todos/seed",
    middleware: [requireAuth()] as const,
    request: {
      body: {
        content: {
          "application/json": {
            schema: SeedWorkspaceInputSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Seed sample Projects and Todos for the authenticated user",
        content: {
          "application/json": {
            schema: SeedWorkspaceResponseSchema,
          },
        },
      },
    },
  });

  router.openapi(seedRoute, async (c) => {
    const actor = c.get("actor");
    if (!actor?.sub) {
      throw PandError.unauthorized("Authentication required");
    }
    const input = c.req.valid("json");
    const db = getDb();
    const result = await seedWorkspaceData(db, { ownerId: actor.sub, force: input.force });
    return c.json(result, 200);
  });

  const importGuestRoute = createRoute({
    method: "post",
    path: "/todos/import-guest",
    middleware: [requireAuth()] as const,
    request: {
      body: {
        content: {
          "application/json": {
            schema: ImportGuestInputSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Import guest browser workspace into authenticated user account",
        content: {
          "application/json": {
            schema: ImportGuestResponseSchema,
          },
        },
      },
    },
  });

  router.openapi(importGuestRoute, async (c) => {
    const actor = c.get("actor");
    if (!actor?.sub) {
      throw PandError.unauthorized("Authentication required");
    }
    const input = c.req.valid("json");
    const db = getDb();

    if (input.onlyIfEmpty) {
      const existingProjects = await db
        .select()
        .from(projects)
        .where(eq(projects.ownerId, actor.sub))
        .limit(1);
      const existingTodos = await db
        .select()
        .from(todos)
        .where(eq(todos.ownerId, actor.sub))
        .limit(1);
      if (existingProjects.length > 0 || existingTodos.length > 0) {
        return c.json(
          {
            imported: false,
            projectsCreated: 0,
            todosCreated: 0,
          },
          200,
        );
      }
    }

    const projectIdMap = new Map<string, string>();
    let projectsCreated = 0;

    for (const gp of input.projects) {
      const [insertedProj] = await db
        .insert(projects)
        .values({
          ownerId: actor.sub,
          name: gp.name,
          description: gp.description ?? null,
          color: gp.color,
          icon: gp.icon,
          archived: gp.archived,
        })
        .returning();
      if (insertedProj) {
        projectIdMap.set(gp.localId, insertedProj.id);
        projectsCreated += 1;
      }
    }

    let todosCreated = 0;
    for (const gtItem of input.todos) {
      const mappedProjectId = gtItem.projectId
        ? (projectIdMap.get(gtItem.projectId) ?? null)
        : null;
      const [insertedTodo] = await db
        .insert(todos)
        .values({
          ownerId: actor.sub,
          projectId: mappedProjectId,
          title: gtItem.title,
          description: gtItem.description ?? null,
          status: gtItem.status,
          priority: gtItem.priority,
          dueDate: gtItem.dueDate ? new Date(gtItem.dueDate) : null,
        })
        .returning();
      if (insertedTodo) {
        todosCreated += 1;
      }
    }

    return c.json(
      {
        imported: true,
        projectsCreated,
        todosCreated,
      },
      200,
    );
  });

  const getRoute = createRoute({
    method: "get",
    path: "/todos/{id}",
    middleware: [requireAuth()] as const,
    request: {
      params: z.object({ id: z.string().uuid() }),
    },
    responses: {
      200: {
        description: "Get Todo",
        content: {
          "application/json": {
            schema: TodoSchema,
          },
        },
      },
    },
  });

  router.openapi(getRoute, async (c) => {
    const actor = c.get("actor");
    if (!actor?.sub) {
      throw PandError.unauthorized("Authentication required");
    }
    const { id } = c.req.valid("param");
    const db = getDb();
    const [row] = await db
      .select()
      .from(todos)
      .where(and(eq(todos.id, id), eq(todos.ownerId, actor.sub)));
    if (!row) {
      throw PandError.notFound("Todo not found");
    }
    return c.json(serializeTodo(row), 200);
  });

  const createEntityRoute = createRoute({
    method: "post",
    path: "/todos",
    middleware: [requireAuth()] as const,
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateTodoSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Created Todo",
        content: {
          "application/json": {
            schema: TodoSchema,
          },
        },
      },
    },
  });

  router.openapi(createEntityRoute, async (c) => {
    const actor = c.get("actor");
    if (!actor?.sub) {
      throw PandError.unauthorized("Authentication required");
    }
    const input = c.req.valid("json");
    const db = getDb();
    const [created] = await db
      .insert(todos)
      .values({
        ownerId: actor.sub,
        projectId: input.projectId || null,
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        priority: input.priority,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
      })
      .returning();

    if (!created) {
      throw PandError.internal("Failed to create Todo");
    }
    return c.json(serializeTodo(created), 201);
  });

  const updateEntityRoute = createRoute({
    method: "patch",
    path: "/todos/{id}",
    middleware: [requireAuth()] as const,
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: {
          "application/json": {
            schema: UpdateTodoSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Updated Todo",
        content: {
          "application/json": {
            schema: TodoSchema,
          },
        },
      },
    },
  });

  router.openapi(updateEntityRoute, async (c) => {
    const actor = c.get("actor");
    if (!actor?.sub) {
      throw PandError.unauthorized("Authentication required");
    }
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const db = getDb();

    const patch: Partial<typeof todos.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.projectId !== undefined) {
      patch.projectId = input.projectId || null;
    }
    if (input.title !== undefined) {
      patch.title = input.title;
    }
    if (input.description !== undefined) {
      patch.description = input.description;
    }
    if (input.status !== undefined) {
      patch.status = input.status;
    }
    if (input.priority !== undefined) {
      patch.priority = input.priority;
    }
    if (input.dueDate !== undefined) {
      patch.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    }

    const [updated] = await db
      .update(todos)
      .set(patch)
      .where(and(eq(todos.id, id), eq(todos.ownerId, actor.sub)))
      .returning();

    if (!updated) {
      throw PandError.notFound("Todo not found");
    }
    return c.json(serializeTodo(updated), 200);
  });

  const deleteEntityRoute = createRoute({
    method: "delete",
    path: "/todos/{id}",
    middleware: [requireAuth()] as const,
    request: {
      params: z.object({ id: z.string().uuid() }),
    },
    responses: {
      200: {
        description: "Deleted Todo",
        content: {
          "application/json": {
            schema: z.object({ deleted: z.boolean(), id: z.string().uuid() }),
          },
        },
      },
    },
  });

  router.openapi(deleteEntityRoute, async (c) => {
    const actor = c.get("actor");
    if (!actor?.sub) {
      throw PandError.unauthorized("Authentication required");
    }
    const { id } = c.req.valid("param");
    const db = getDb();
    const [deleted] = await db
      .delete(todos)
      .where(and(eq(todos.id, id), eq(todos.ownerId, actor.sub)))
      .returning();
    if (!deleted) {
      throw PandError.notFound("Todo not found");
    }
    return c.json({ deleted: true, id }, 200);
  });

  return router;
}
