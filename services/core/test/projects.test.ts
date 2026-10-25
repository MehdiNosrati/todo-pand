import path from "node:path";
import { fileURLToPath } from "node:url";
import { migrateServiceSchema } from "@pand/db";
import { createTestDatabase, mintTestInternalToken } from "@pand/testing";
import { describe, expect, it } from "vitest";
import { buildCoreApp } from "../src/app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe("core Project CRUD", () => {
  it("creates, lists, gets, updates, and deletes Project", async () => {
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

      const createPayload = {
        name: "Sample Name",
        description: "Sample Description text",
        color: "#6366f1",
        icon: "folder",
        archived: false,
      };

      const createRes = await app.request("/projects", {
        method: "POST",
        headers,
        body: JSON.stringify(createPayload),
      });
      expect(createRes.status).toBe(201);
      const created = (await createRes.json()) as { id: string };
      expect(created.id).toBeDefined();

      const listRes = await app.request("/projects", { headers });
      expect(listRes.status).toBe(200);
      const listBody = (await listRes.json()) as { items: Array<{ id: string }> };
      expect(listBody.items.some((item) => item.id === created.id)).toBe(true);

      const getRes = await app.request(`/projects/${created.id}`, { headers });
      expect(getRes.status).toBe(200);

      const patchRes = await app.request(`/projects/${created.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({}),
      });
      expect(patchRes.status).toBe(200);

      const delRes = await app.request(`/projects/${created.id}`, {
        method: "DELETE",
        headers,
      });
      expect(delRes.status).toBe(200);

      const afterDelRes = await app.request(`/projects/${created.id}`, { headers });
      expect(afterDelRes.status).toBe(404);
    } finally {
      await closeDb();
      await testDb.cleanup();
    }
  });

  it("enforces multi-user isolation on all project operations", async () => {
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

      // User 1 creates a project
      const createRes1 = await app.request("/projects", {
        method: "POST",
        headers: headers1,
        body: JSON.stringify({
          name: "Alpha Confidential",
          description: "Only Alpha can see this",
          color: "#ef4444",
        }),
      });
      expect(createRes1.status).toBe(201);
      const alphaProj = (await createRes1.json()) as { id: string; ownerId: string };
      expect(alphaProj.ownerId).toBe("user-alpha");

      // User 2 lists projects -> should be empty
      const listRes2 = await app.request("/projects", { headers: headers2 });
      expect(listRes2.status).toBe(200);
      const listBody2 = (await listRes2.json()) as { items: Array<{ id: string }> };
      expect(listBody2.items).toHaveLength(0);

      // User 2 tries to GET Alpha's project -> 404
      const getRes2 = await app.request(`/projects/${alphaProj.id}`, { headers: headers2 });
      expect(getRes2.status).toBe(404);

      // User 2 tries to PATCH Alpha's project -> 404
      const patchRes2 = await app.request(`/projects/${alphaProj.id}`, {
        method: "PATCH",
        headers: headers2,
        body: JSON.stringify({ name: "Hacked by Beta" }),
      });
      expect(patchRes2.status).toBe(404);

      // User 2 tries to DELETE Alpha's project -> 404
      const deleteRes2 = await app.request(`/projects/${alphaProj.id}`, {
        method: "DELETE",
        headers: headers2,
      });
      expect(deleteRes2.status).toBe(404);

      // User 1 can still GET and sees original untouched name
      const verifyRes1 = await app.request(`/projects/${alphaProj.id}`, { headers: headers1 });
      expect(verifyRes1.status).toBe(200);
      const verifyBody1 = (await verifyRes1.json()) as { name: string };
      expect(verifyBody1.name).toBe("Alpha Confidential");
    } finally {
      await closeDb();
      await testDb.cleanup();
    }
  });
});
