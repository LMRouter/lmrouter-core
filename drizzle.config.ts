import { defineConfig } from "drizzle-kit";

import { getConfig } from "./src/utils/config.ts";

const cfg = getConfig();

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/models/*.ts",
  out: "./drizzle",
  dbCredentials: cfg.auth.enabled
    ? {
        url: cfg.auth.database_url,
      }
    : undefined,
});
