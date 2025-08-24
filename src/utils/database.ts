// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { drizzle } from "drizzle-orm/neon-http";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

import { getConfig } from "./config.js";
import * as authSchema from "../models/auth.js";
import * as billingSchema from "../models/billing.js";
import type { ContextEnv } from "../types/hono.js";

let dbCache: ReturnType<typeof drizzle> | null = null;

export const getDb = (c?: Context<ContextEnv>): ReturnType<typeof drizzle> => {
  if (!dbCache) {
    const cfg = getConfig(c);
    if (!cfg.auth.enabled) {
      throw new HTTPException(400, {
        message: "Auth is not enabled",
      });
    }
    dbCache = drizzle(cfg.auth.database_url, {
      schema: {
        ...authSchema,
        ...billingSchema,
      },
    });
  }
  return dbCache;
};
