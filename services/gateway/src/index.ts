import { serveService } from "@pand/service";
import { app } from "./app.js";

serveService(app, {
  serviceName: "gateway",
  projectName: "todo-pand",
  port: Number(process.env.PORT ?? 4901),
});
