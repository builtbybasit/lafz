import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./server/db.ts",
  casing: "snake_case",
  dbCredentials: { url: "data/lafz.db" },
});
