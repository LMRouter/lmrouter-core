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

  if (auth.type === "better-auth") {
    const res = await getDb(c)
      .select({
        balance: balance.balance,
      })
      .from(balance)
      .where(
        and(eq(balance.ownerType, "user"), eq(balance.ownerId, auth.user.id)),
      );
    if (res.length !== 1) {
      return c.json({ error: { message: "Internal server error" } }, 500);
    }
    if (new Decimal(res[0].balance).lessThanOrEqualTo(0)) {
      return c.json({ error: { message: "Insufficient balance" } }, 402);
    }
  } else if (auth.type === "api-key") {
    const res = await getDb(c)
      .select({
        balance: balance.balance,
      })
      .from(balance)
      .where(
        and(
          eq(balance.ownerType, auth.apiKey.ownerType),
          eq(balance.ownerId, auth.apiKey.ownerId),
        ),
      );
    if (res.length !== 1) {
      return c.json({ error: { message: "Internal server error" } }, 500);
    }
    if (new Decimal(res[0].balance).lessThanOrEqualTo(0)) {
      return c.json({ error: { message: "Insufficient balance" } }, 402);
    }
  }

  await next();
});
