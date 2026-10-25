import { defineConfig } from "@pand/config";

export default defineConfig({
  name: "todo-pand",
  displayName: "Todo Pand",
  basePort: 4900,
  auth: {
    adminEmails: ["foo@bar.com"],
  },
  services: {
    core: { portOffset: 10, db: true },
  },
  apps: {
    web: true,
    admin: true,
    ios: false,
    android: false,
  },
});
