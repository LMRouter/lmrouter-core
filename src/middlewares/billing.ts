// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { Decimal } from "decimal.js";
import { and, eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";

import { balance } from "../models/billing.js";
import type { ContextEnv } from "../types/hono.js";
import { getConfig } from "../utils/config.js";
import { getDb } from "../utils/database.js";

export const ensureBalance = createMiddleware<ContextEnv>(async (c, next) => {
  const cfg = getConfig(c);
  if (!cfg.auth.enabled) {
    await next();
    return;
  }

  const auth = c.var.auth;
  if (!auth) {
    return c.json({ error: { message: "Unauthorized" } }, 401);
  }

  if (auth.type === "access-key" || auth.type === "byok") {
    await next();
    return;
  }

  const ownerType =
    auth.type === "better-auth" ? auth.ownerType : auth.apiKey.ownerType;
  const ownerId =
    auth.type === "better-auth" ? auth.ownerId : auth.apiKey.ownerId;

  const res = await getDb(c)
    .select({
      balance: balance.balance,
    })
    .from(balance)
    .where(and(eq(balance.ownerType, ownerType), eq(balance.ownerId, ownerId)));
  if (res.length !== 1) {
    return c.json({ error: { message: "Internal server error" } }, 500);
  }
  if (new Decimal(res[0].balance).lessThanOrEqualTo(0)) {
    return c.json({ error: { message: "Insufficient balance" } }, 402);
  }

  await next();
});
