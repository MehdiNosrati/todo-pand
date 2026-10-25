import { serveService } from "@pand/service";
import { buildCoreApp } from "./app.js";

const { app, closeDb } = buildCoreApp();

serveService(app, {
  serviceName: "core",
  projectName: "todo-pand",
  port: Number(process.env.PORT ?? 4910),
  closeDb,
});
