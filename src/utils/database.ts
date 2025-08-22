import { drizzle } from "drizzle-orm/neon-http";
import type { Context } from "hono";

import { getConfig } from "./config.js";
import type { ContextEnv } from "../types/hono.js";

let dbCache: ReturnType<typeof drizzle> | null = null;

export const getDb = (c?: Context<ContextEnv>): ReturnType<typeof drizzle> => {
  if (!dbCache) {
    const cfg = getConfig(c);
    if (!cfg.auth.enabled) {
      throw new Error("Auth is not enabled");
    }
    dbCache = drizzle(cfg.auth.database_url);
  }
  return dbCache;
};
