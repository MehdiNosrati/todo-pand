import { pgSchema } from "@pand/db";

export const coreSchema = pgSchema("core");
export { projects } from "./projects.js";
export { todos } from "./todos.js";
// pand:schema-exports
