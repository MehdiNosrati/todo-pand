import { describe, expect, it } from "vitest";
import { buildCoreApp } from "../src/app.js";

describe("core service health", () => {
  it("responds 200 on /healthz", async () => {
    const { app, closeDb } = buildCoreApp();
    try {
      const res = await app.request("/healthz");
      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string; service: string };
      expect(body.status).toBe("ok");
      expect(body.service).toBe("core");
    } finally {
      await closeDb();
    }
  });
});
