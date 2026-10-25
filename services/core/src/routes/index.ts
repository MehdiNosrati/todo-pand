import type { PandServiceApp } from "@pand/service";
import type { CoreDbInstance } from "../db/index.js";
import { createProjectsRouter } from "./projects.js";
import { createTodosRouter } from "./todos.js";
// pand:route-imports

export function mountRoutes(app: PandServiceApp, getDb: () => CoreDbInstance["db"]) {
  void app;
  void getDb;
  app.route("/", createProjectsRouter(getDb));
  app.route("/", createTodosRouter(getDb));
  // pand:route-mounts
}
