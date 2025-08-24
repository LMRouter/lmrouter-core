// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

import { getConfig } from "./config.js";
import { getDb } from "./database.js";
import { balance } from "../models/billing.js";
import type { ContextEnv } from "../types/hono.js";

let authCache: ReturnType<typeof betterAuth> | null = null;

export const getAuth = (
  c?: Context<ContextEnv>,
): ReturnType<typeof betterAuth> => {
  if (!authCache) {
    const cfg = getConfig(c);
    if (!cfg.auth.enabled) {
      throw new HTTPException(400, {
        message: "Auth is not enabled",
      });
    }
    authCache = betterAuth({
      baseURL: cfg.auth.better_auth.url,
      basePath: "/v1/auth",
      trustedOrigins: cfg.auth.better_auth.trusted_origins,
      secret: cfg.auth.better_auth.secret,
      telemetry: {
        enabled: cfg.auth.better_auth.telemetry,
      },
      database: drizzleAdapter(getDb(c), {
        provider: "pg",
      }),
      emailAndPassword: {
        enabled: true,
      },
      databaseHooks: {
        user: {
          create: {
            after: async (user) => {
              await getDb(c).insert(balance).values({
                ownerType: "user",
                ownerId: user.id,
              });
            },
          },
        },
      },
    });
  }
  return authCache;
};

// Uncomment to call `npm run auth:generate`
// export const auth = getAuth();
