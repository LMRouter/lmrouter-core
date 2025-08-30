// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { Decimal } from "decimal.js";
import { and, eq, sql } from "drizzle-orm";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import jsonLogic from "json-logic-js";
import { Stripe } from "stripe";

import {
  getConfig,
  type LMRouterConfigModelProviderPricing,
} from "./config.js";
import { getDb } from "./database.js";
import {
  balance,
  ledger,
  type LedgerMetadata,
  type LedgerMetadataApiCallTimestamps,
} from "../models/billing.js";
import type { ContextEnv } from "../types/hono.js";
import { getRemoteIp } from "./utils.js";

export interface LMRouterApiCallUsage {
  service_tier?: string;
  input?: number;
  input_image?: number;
  input_audio?: number;
  input_audio_time?: number;
  output?: number;
  output_audio?: number;
  image?: number;
  image_quality?: string;
  image_size?: string;
  web_search?: number;
  code_interpreter?: number;
  request?: number;
  input_cache_reads?: number;
  input_cache_writes?: number;
}

export const calculateCost = (
  usage?: LMRouterApiCallUsage,
  pricing?: LMRouterConfigModelProviderPricing,
): Decimal => {
  if (!usage || !pricing) {
    return new Decimal(0);
  }

  if (pricing.type === "fixed") {
    let cost = new Decimal(0);
    cost = cost.plus(
      new Decimal(usage.input ?? 0).mul(pricing.input ?? 0).dividedBy(1000000),
    );
    cost = cost.plus(
      new Decimal(usage.input_image ?? 0)
        .mul(pricing.input_image ?? 0)
        .dividedBy(1000000),
    );
    cost = cost.plus(
      new Decimal(usage.input_audio ?? 0)
        .mul(pricing.input_audio ?? 0)
        .dividedBy(1000000),
    );
    cost = cost.plus(
      new Decimal(usage.input_audio_time ?? 0)
        .mul(pricing.input_audio_time ?? 0)
        .dividedBy(60),
    );
    cost = cost.plus(
      new Decimal(usage.output ?? 0)
        .mul(pricing.output ?? 0)
        .dividedBy(1000000),
    );
    cost = cost.plus(
      new Decimal(usage.output_audio ?? 0)
        .mul(pricing.output_audio ?? 0)
        .dividedBy(1000000),
    );
    cost = cost.plus(new Decimal(usage.image ?? 0).mul(pricing.image ?? 0));
    cost = cost.plus(
      new Decimal(usage.web_search ?? 0).mul(pricing.web_search ?? 0),
    );
    cost = cost.plus(
      new Decimal(usage.code_interpreter ?? 0).mul(
        pricing.code_interpreter ?? 0,
      ),
    );
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
  } else if (pricing.type === "tiered") {
    for (const tier of pricing.tiers) {
      if (!tier.predicate) {
        return calculateCost(usage, tier.pricing);
      }

      const predicate = jsonLogic.apply(tier.predicate, usage);
      if (predicate) {
        return calculateCost(usage, tier.pricing);
      }
    }
  }

  throw new HTTPException(500, {
    message: "Unknown pricing type",
  });
};

export const recordApiCall = async (
  c: Context<ContextEnv>,
  provider: string,
  status: number,
  timestamps: LedgerMetadataApiCallTimestamps,
  usage?: LMRouterApiCallUsage,
  pricing?: LMRouterConfigModelProviderPricing,
  error?: string,
) => {
  if (!getConfig(c).auth.enabled || !c.var.auth) {
    return;
  }

  const metadata: LedgerMetadata = {
    type: "api-call",
    data: {
      api_key_id:
        c.var.auth.type === "api-key" ? c.var.auth.apiKey.id : undefined,
      model: c.var.modelName ?? "",
      provider,
      endpoint: c.req.path,
      status,
      error,
      timestamps,
      ip: getRemoteIp(c),
      referer: {
        name: c.req.header("X-Title"),
        url: c.req.header("HTTP-Referer"),
      },
      usage,
      pricing,
    },
  };

  const ownerType =
    c.var.auth.type === "better-auth"
      ? c.var.auth.ownerType
      : c.var.auth.type === "api-key"
        ? c.var.auth.apiKey.ownerType
        : c.var.auth.type;
  const ownerId =
    c.var.auth.type === "better-auth"
      ? c.var.auth.ownerId
      : c.var.auth.type === "api-key"
        ? c.var.auth.apiKey.ownerId
        : "";

  await updateBilling(
    ownerType,
    ownerId,
    calculateCost(usage, pricing).neg(),
    metadata,
    c,
  );
};

export const handleStripeWebhook = async (event: Stripe.Event) => {
  if (event.type !== "checkout.session.completed") {
    return;
  }

  const data = event.data.object;
  if (!data.metadata) {
    return;
  }

  const { owner_type, owner_id, amount } = data.metadata;
  if (!owner_type || !owner_id || !amount) {
    return;
  }

  await updateBilling(owner_type, owner_id, new Decimal(amount), {
    type: "payment",
    data: {
      provider: "stripe",
      session: data,
    },
  });
};

export const updateBilling = async (
  ownerType: string,
  ownerId: string,
  amount: Decimal,
  metadata: LedgerMetadata,
  c?: Context<ContextEnv>,
) => {
  await getDb(c).insert(ledger).values({
    ownerType,
    ownerId,
    amount: amount.toString(),
    metadata,
  });
  await getDb(c)
    .update(balance)
    .set({
      balance: sql`balance + (${amount.toString()})`,
    })
    .where(and(eq(balance.ownerType, ownerType), eq(balance.ownerId, ownerId)));
};
