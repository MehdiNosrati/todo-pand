import { and, asc, eq, gt, ilike, or } from "@pand/db";
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

type SqlCond = ReturnType<typeof eq>;

export const ProjectSchema = z
  .object({
    id: z.string().uuid(),
    ownerId: z.string(),
    name: z.string().min(1).max(255),
    description: z.string().nullable(),
    color: z.string().min(1).max(255),
    icon: z.string().min(1).max(255),
    archived: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi("Project");

export const CreateProjectSchema = z
  .object({
    name: z.string().min(1).max(255),
    description: z.string().nullable().optional(),
    color: z.string().min(1).max(255).optional().default("#6366f1"),
    icon: z.string().min(1).max(255).optional().default("folder"),
    archived: z.boolean().optional().default(false),
  })
  .openapi("CreateProjectInput");

export const UpdateProjectSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().nullable().optional(),
    color: z.string().min(1).max(255).optional(),
    icon: z.string().min(1).max(255).optional(),
    archived: z.boolean().optional(),
  })
  .openapi("UpdateProjectInput");

export const ProjectListResponseSchema = z
  .object({
    items: z.array(ProjectSchema),
    nextCursor: z.string().nullable(),
  })
  .openapi("ProjectListResponse");

export const projectAdminMeta: AdminEntityMeta = {
  service: "core",
  entity: "Project",
  table: "projects",
  basePath: "/api/v1/core/projects",
  primaryKey: "id",
  displayField: "name",
  fields: [
    { name: "id", label: "ID", type: "uuid", required: true, readOnly: true },
    { name: "ownerId", label: "Owner ID", type: "string", required: true, readOnly: true },
    {
      name: "name",
      label: "Name",
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
      name: "color",
      label: "Color",
      type: "string",
      required: false,
      readOnly: false,
      defaultValue: "#6366f1",
    },
    {
      name: "icon",
      label: "Icon",
      type: "string",
      required: false,
      readOnly: false,
      defaultValue: "folder",
    },
    {
      name: "archived",
      label: "Archived",
      type: "boolean",
      required: false,
      readOnly: false,
      defaultValue: false,
    },
    { name: "createdAt", label: "Created At", type: "datetime", required: true, readOnly: true },
    { name: "updatedAt", label: "Updated At", type: "datetime", required: true, readOnly: true },
  ],
};

function serializeProject(row: typeof projects.$inferSelect): z.infer<typeof ProjectSchema> {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    description: row.description,
    color: row.color,
    icon: row.icon,
    archived: row.archived,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function createProjectsRouter(getDb: () => CoreDbInstance["db"]) {
  const router = new OpenAPIHono<{ Variables: ServiceVariables }>();

  const listRoute = createRoute({
    method: "get",
    path: "/projects",
    middleware: [requireAuth()] as const,
    request: {
      query: z.object({
        limit: z.coerce.number().int().min(1).max(100).default(50),
        cursor: z.string().optional(),
        q: z.string().optional(),
        search: z.string().optional(),
        archived: z.enum(["true", "false"]).optional(),
      }),
    },
    responses: {
      200: {
        description: "List Projects",
        content: {
          "application/json": {
            schema: ProjectListResponseSchema,
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
    const { limit, cursor, q, search, archived } = c.req.valid("query");
    const db = getDb();
    const conditions: SqlCond[] = [eq(projects.ownerId, actor.sub)];
    const searchTerm = (q ?? search)?.trim();

    if (searchTerm) {
      const searchCond = or(
        ilike(projects.name, `%${searchTerm}%`),
        ilike(projects.description, `%${searchTerm}%`),
      );
      if (searchCond) {
        conditions.push(searchCond);
      }
    }
    if (archived !== undefined) {
      conditions.push(eq(projects.archived, archived === "true"));
    }
    if (cursor) {
      conditions.push(gt(projects.id, cursor));
    }

    let rows = await db
      .select()
      .from(projects)
      .where(and(...conditions))
      .orderBy(asc(projects.createdAt))
      .limit(limit + 1);

    let nextCursor: string | null = null;
    if (rows.length > limit) {
      const popped = rows.pop();
      nextCursor = popped?.id ?? null;
      rows = rows.slice(0, limit);
    }

    return c.json(
      {
        items: rows.map(serializeProject),
        nextCursor,
      },
      200,
    );
  });

  const getRoute = createRoute({
    method: "get",
    path: "/projects/{id}",
    middleware: [requireAuth()] as const,
    request: {
      params: z.object({ id: z.string().uuid() }),
    },
    responses: {
      200: {
        description: "Get Project",
        content: {
          "application/json": {
            schema: ProjectSchema,
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
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.ownerId, actor.sub)));
    if (!row) {
      throw PandError.notFound("Project not found");
    }
    return c.json(serializeProject(row), 200);
  });

  const createEntityRoute = createRoute({
    method: "post",
    path: "/projects",
    middleware: [requireAuth()] as const,
    request: {
      body: {
        content: {
          "application/json": {
            schema: CreateProjectSchema,
          },
        },
      },
    },
    responses: {
      201: {
        description: "Created Project",
        content: {
          "application/json": {
            schema: ProjectSchema,
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
      .insert(projects)
      .values({
        ownerId: actor.sub,
        name: input.name,
        description: input.description ?? null,
        color: input.color,
        icon: input.icon,
        archived: input.archived,
      })
      .returning();

    if (!created) {
      throw PandError.internal("Failed to create Project");
    }
    return c.json(serializeProject(created), 201);
  });

  const updateEntityRoute = createRoute({
    method: "patch",
    path: "/projects/{id}",
    middleware: [requireAuth()] as const,
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: {
        content: {
          "application/json": {
            schema: UpdateProjectSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Updated Project",
        content: {
          "application/json": {
            schema: ProjectSchema,
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

    const patch: Partial<typeof projects.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (input.name !== undefined) {
      patch.name = input.name;
    }
    if (input.description !== undefined) {
      patch.description = input.description;
    }
    if (input.color !== undefined) {
      patch.color = input.color;
    }
    if (input.icon !== undefined) {
      patch.icon = input.icon;
    }
    if (input.archived !== undefined) {
      patch.archived = input.archived;
    }

    const [updated] = await db
      .update(projects)
      .set(patch)
      .where(and(eq(projects.id, id), eq(projects.ownerId, actor.sub)))
      .returning();

    if (!updated) {
      throw PandError.notFound("Project not found");
    }
    return c.json(serializeProject(updated), 200);
  });

  const deleteEntityRoute = createRoute({
    method: "delete",
    path: "/projects/{id}",
    middleware: [requireAuth()] as const,
    request: {
      params: z.object({ id: z.string().uuid() }),
    },
    responses: {
      200: {
        description: "Deleted Project",
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
    await db
      .update(todos)
      .set({ projectId: null, updatedAt: new Date() })
      .where(and(eq(todos.projectId, id), eq(todos.ownerId, actor.sub)));
    const [deleted] = await db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.ownerId, actor.sub)))
      .returning();
    if (!deleted) {
      throw PandError.notFound("Project not found");
    }
    return c.json({ deleted: true, id }, 200);
  });

  return router;
}
