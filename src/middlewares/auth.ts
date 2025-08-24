// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";

import { apiKey as apiKeyModel } from "../models/billing.js";
import type { AuthType, ContextEnv } from "../types/hono.js";
import { hashApiKey } from "../utils/api-key.js";
import { getAuth } from "../utils/auth.js";
import { getConfig } from "../utils/config.js";
import { getDb } from "../utils/database.js";

export const auth = createMiddleware<ContextEnv>(async (c, next) => {
  const cfg = getConfig(c);
  const apiKey =
    c.req.header("Authorization")?.split(" ")[1] ?? c.req.header("x-api-key");
  if (apiKey) {
    if (apiKey.startsWith("BYOK:")) {
      c.set("auth", {
        type: "byok",
        byok: apiKey.slice(5),
      });
      await next();
      return;
    }

    if (cfg.access_keys.includes(apiKey)) {
      c.set("auth", {
        type: "access-key",
        accessKey: apiKey,
      });
      await next();
      return;
    }

    if (cfg.auth.enabled) {
      const apiKeyRow = await getDb(c)
        .select()
        .from(apiKeyModel)
        .where(eq(apiKeyModel.keyHash, hashApiKey(apiKey)));
      if (apiKeyRow.length === 1) {
        c.set("auth", {
          type: "api-key",
          apiKey: apiKeyRow[0],
        });
        await next();
        return;
      }
    }
  }

  if (cfg.auth.enabled) {
    const session = await getAuth(c).api.getSession({
      headers: c.req.raw.headers,
    });
    if (session) {
      c.set("auth", {
        type: "better-auth",
        user: session.user,
        session: session.session,
      });
      await next();
      return;
    }
  }

  await next();
});

export const requireAuth = (type?: AuthType | AuthType[]) => {
  return createMiddleware<ContextEnv>(async (c, next) => {
    const auth = c.var.auth;
    if (!auth) {
      return c.json({ error: { message: "Unauthorized" } }, 401);
    }

    if (Array.isArray(type)) {
      if (!type.includes(auth.type)) {
        return c.json({ error: { message: "Unauthorized" } }, 401);
      }
    } else if (type && auth.type !== type) {
      return c.json({ error: { message: "Unauthorized" } }, 401);
    }

    await next();
  });
};
