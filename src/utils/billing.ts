// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { Decimal } from "decimal.js";
import { and, eq, sql } from "drizzle-orm";
import type { Context } from "hono";

import {
  getConfig,
  type LMRouterConfigModelProviderPricing,
} from "./config.js";
import { getDb } from "./database.js";
import { balance, ledger, type LedgerMetadata } from "../models/billing.js";
import type { ContextEnv } from "../types/hono.js";

export const calculateCost = (
  usage?: LMRouterConfigModelProviderPricing,
  pricing?: LMRouterConfigModelProviderPricing,
): Decimal => {
  let cost = new Decimal(0);
  if (!usage || !pricing) {
    return cost;
  }

  cost = cost.plus(
    new Decimal(usage.input ?? 0).mul(pricing.input ?? 0).dividedBy(1000000),
  );
  cost = cost.plus(
    new Decimal(usage.output ?? 0).mul(pricing.output ?? 0).dividedBy(1000000),
  );
  cost = cost.plus(new Decimal(usage.image ?? 0).mul(pricing.image ?? 0));
  cost = cost.plus(new Decimal(usage.request ?? 0).mul(pricing.request ?? 0));
  cost = cost.plus(
    new Decimal(usage.input_cache_reads ?? 0)
      .mul(pricing.input_cache_reads ?? 0)
      .dividedBy(1000000),
  );
  cost = cost.plus(
    new Decimal(usage.input_cache_writes ?? 0)
      .mul(pricing.input_cache_writes ?? 0)
      .dividedBy(1000000),
  );

  return cost;
};

export const updateBilling = async (
  c: Context<ContextEnv>,
  ownerType: string,
  ownerId: string,
  amount: Decimal,
  metadata: LedgerMetadata,
) => {
  if (!getConfig(c).auth.enabled) {
    return;
  }

  await getDb(c).transaction(async (tx) => {
    await tx.insert(ledger).values({
      ownerType,
      ownerId,
      amount: amount.toString(),
      metadata,
    });
    await tx
      .update(balance)
      .set({
        balance: sql`balance + (${amount})`,
      })
      .where(
        and(eq(balance.ownerType, ownerType), eq(balance.ownerId, ownerId)),
      );
  });
};
