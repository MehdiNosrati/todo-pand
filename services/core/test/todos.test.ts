import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrateServiceSchema } from "@pand/db";
import { createTestDatabase, mintTestInternalToken } from "@pand/testing";
import { describe, expect, it } from "vitest";
import { buildCoreApp } from "../src/app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("core Todo CRUD & custom workspace endpoints", () => {
  it("creates, lists, filters, computes stats, bulk-updates, clears completed, and seeds todos", async () => {
    const testDb = await createTestDatabase();
    const { app, closeDb } = buildCoreApp(testDb.databaseUrl);

    try {
      await migrateServiceSchema({
        databaseUrl: testDb.databaseUrl,
        serviceName: "core",
        migrationsFolder: path.resolve(__dirname, "../drizzle"),
      });

      const token = await mintTestInternalToken({
        sub: "user-test-1",
        role: "admin",
      });

      const headers = {
        "content-type": "application/json",
        "x-pand-internal-token": token,
      };

      const projRes = await app.request("/projects", {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: "Engineering",
          description: "Core backend work",
          color: "#0ea5e9",
          icon: "code",
        }),
      });
      expect(projRes.status).toBe(201);
      const project = (await projRes.json()) as { id: string; name: string };

      const createPayload = {
        projectId: project.id,
        title: "Sample Title",
        description: "Sample Description text",
        status: "todo",
        priority: "urgent",
        dueDate: "2020-01-01T00:00:00.000Z", // overdue
      };

      const createRes = await app.request("/todos", {
        method: "POST",
        headers,
        body: JSON.stringify(createPayload),
      });
      expect(createRes.status).toBe(201);
      const created = (await createRes.json()) as { id: string; status: string };
      expect(created.id).toBeDefined();

      const secondRes = await app.request("/todos", {
        method: "POST",
        headers,
        body: JSON.stringify({
          projectId: project.id,
          title: "Second Task",
          status: "in_progress",
          priority: "medium",
        }),
      });
      expect(secondRes.status).toBe(201);
      const second = (await secondRes.json()) as { id: string };

      const listRes = await app.request(`/todos?projectId=${project.id}&priority=urgent`, {
        headers,
      });
      expect(listRes.status).toBe(200);
      const listBody = (await listRes.json()) as { items: Array<{ id: string }> };
      expect(listBody.items).toHaveLength(1);
      expect(listBody.items[0]?.id).toBe(created.id);

      const statsRes = await app.request("/todos/stats", { headers });
      expect(statsRes.status).toBe(200);
      const stats = (await statsRes.json()) as {
        total: number;
        overdue: number;
        byStatus: { todo: number; in_progress: number; done: number };
        byPriority: { urgent: number; medium: number };
      };
      expect(stats.total).toBe(2);
      expect(stats.overdue).toBe(1);
      expect(stats.byStatus.todo).toBe(1);
      expect(stats.byStatus.in_progress).toBe(1);
      expect(stats.byPriority.urgent).toBe(1);

      const bulkRes = await app.request("/todos/bulk-status", {
        method: "POST",
        headers,
        body: JSON.stringify({
          projectId: project.id,
          status: "done",
        }),
      });
      expect(bulkRes.status).toBe(200);
      const bulkBody = (await bulkRes.json()) as { updatedCount: number };
      expect(bulkBody.updatedCount).toBe(2);

      const clearRes = await app.request("/todos/clear-completed", {
        method: "POST",
        headers,
        body: JSON.stringify({ projectId: project.id }),
      });
      expect(clearRes.status).toBe(200);
      const clearBody = (await clearRes.json()) as { deletedCount: number };
      expect(clearBody.deletedCount).toBe(2);

      const afterClearRes = await app.request(`/todos/${second.id}`, { headers });
      expect(afterClearRes.status).toBe(404);

      const seedRes = await app.request("/todos/seed", {
        method: "POST",
        headers,
        body: JSON.stringify({ force: true }),
      });
      expect(seedRes.status).toBe(200);
      const seedBody = (await seedRes.json()) as {
        seeded: boolean;
        projectsCreated: number;
        todosCreated: number;
      };
      expect(seedBody.seeded).toBe(true);
      expect(seedBody.projectsCreated).toBeGreaterThanOrEqual(3);
      expect(seedBody.todosCreated).toBeGreaterThanOrEqual(6);
    } finally {
      await closeDb();
      await testDb.cleanup();
    }
  });

  it("enforces multi-user isolation on todos and verifies guest import", async () => {
    const testDb = await createTestDatabase();
    const { app, closeDb } = buildCoreApp(testDb.databaseUrl);

    try {
      await migrateServiceSchema({
        databaseUrl: testDb.databaseUrl,
        serviceName: "core",
        migrationsFolder: path.resolve(__dirname, "../drizzle"),
      });

      const tokenUser1 = await mintTestInternalToken({
        sub: "user-alpha",
        role: "user",
      });
      const tokenUser2 = await mintTestInternalToken({
        sub: "user-beta",
        role: "user",
      });

      const headers1 = {
        "content-type": "application/json",
        "x-pand-internal-token": tokenUser1,
      };
      const headers2 = {
        "content-type": "application/json",
        "x-pand-internal-token": tokenUser2,
      };

      // User 1 creates a todo
      const createRes1 = await app.request("/todos", {
        method: "POST",
        headers: headers1,
        body: JSON.stringify({
          title: "Alpha Secret Todo",
          status: "todo",
          priority: "urgent",
        }),
      });
      expect(createRes1.status).toBe(201);
      const alphaTodo = (await createRes1.json()) as { id: string; ownerId: string };
      expect(alphaTodo.ownerId).toBe("user-alpha");

      // User 2 lists todos -> must be 0
      const listRes2 = await app.request("/todos", { headers: headers2 });
      expect(listRes2.status).toBe(200);
      const listBody2 = (await listRes2.json()) as { items: Array<{ id: string }> };
      expect(listBody2.items).toHaveLength(0);

      // User 2 stats -> all 0
      const statsRes2 = await app.request("/todos/stats", { headers: headers2 });
      expect(statsRes2.status).toBe(200);
      const stats2 = (await statsRes2.json()) as { total: number };
      expect(stats2.total).toBe(0);

      // User 2 cannot access, patch, or delete User 1's todo
      const getRes2 = await app.request(`/todos/${alphaTodo.id}`, { headers: headers2 });
      expect(getRes2.status).toBe(404);

      const patchRes2 = await app.request(`/todos/${alphaTodo.id}`, {
        method: "PATCH",
        headers: headers2,
        body: JSON.stringify({ status: "done" }),
      });
      expect(patchRes2.status).toBe(404);

      const deleteRes2 = await app.request(`/todos/${alphaTodo.id}`, {
        method: "DELETE",
        headers: headers2,
      });
      expect(deleteRes2.status).toBe(404);

      // User 2 imports guest workspace into their fresh account
      const guestImportRes = await app.request("/todos/import-guest", {
        method: "POST",
        headers: headers2,
        body: JSON.stringify({
          onlyIfEmpty: true,
          projects: [
            {
              localId: "local-proj-1",
              name: "Beta Imported Project",
              description: "Imported from guest",
              color: "#10b981",
              icon: "star",
              archived: false,
            },
          ],
          todos: [
            {
              projectId: "local-proj-1",
              title: "Imported Task 1",
              status: "todo",
              priority: "high",
            },
            {
              projectId: null,
              title: "Imported Task 2",
              status: "done",
              priority: "low",
            },
          ],
        }),
      });
      expect(guestImportRes.status).toBe(200);
      const importBody = (await guestImportRes.json()) as {
        imported: boolean;
        projectsCreated: number;
        todosCreated: number;
      };
      expect(importBody.imported).toBe(true);
      expect(importBody.projectsCreated).toBe(1);
      expect(importBody.todosCreated).toBe(2);

      // Verify User 2 now has their 2 imported tasks
      const listRes2After = await app.request("/todos", { headers: headers2 });
      expect(listRes2After.status).toBe(200);
      const listBody2After = (await listRes2After.json()) as {
        items: Array<{ id: string; ownerId: string }>;
      };
      expect(listBody2After.items).toHaveLength(2);
      expect(listBody2After.items.every((t) => t.ownerId === "user-beta")).toBe(true);

      // Calling import-guest again with onlyIfEmpty: true should be skipped (account already has data)
      const guestImportSkipRes = await app.request("/todos/import-guest", {
        method: "POST",
        headers: headers2,
        body: JSON.stringify({
          onlyIfEmpty: true,
          projects: [],
          todos: [
            {
              title: "Another task",
              status: "todo",
              priority: "medium",
            },
          ],
        }),
      });
      expect(guestImportSkipRes.status).toBe(200);
      const skipBody = (await guestImportSkipRes.json()) as {
        imported: boolean;
        todosCreated: number;
      };
      expect(skipBody.imported).toBe(false);
      expect(skipBody.todosCreated).toBe(0);

      // Verify User 1's workspace was completely unaffected
      const listRes1After = await app.request("/todos", { headers: headers1 });
      expect(listRes1After.status).toBe(200);
      const listBody1After = (await listRes1After.json()) as {
        items: Array<{ id: string; title: string }>;
      };
      expect(listBody1After.items).toHaveLength(1);
      expect(listBody1After.items[0]?.title).toBe("Alpha Secret Todo");
    } finally {
      await closeDb();
      await testDb.cleanup();
    }
  });
});
