// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import stripe from "stripe";

import { getConfig } from "./config.js";
import type { ContextEnv } from "../types/hono.js";

let stripeCache: StripeClient | null = null;

export const getStripe = (c?: Context<ContextEnv>): StripeClient => {
  if (!stripeCache) {
    const cfg = getConfig(c);
    if (!cfg.auth.enabled) {
      throw new HTTPException(400, {
        message: "Auth is not enabled",
      });
    }
    stripeCache = new StripeClient(
      cfg.auth.billing.stripe.secret_key,
      cfg.auth.billing.stripe.webhook_secret,
      cfg.auth.billing.stripe.lmrouter_credits_product_id,
    );
  }
  return stripeCache;
};

class StripeClient {
  stripe: stripe;
  webhookSecret: string;
  lmrouterCreditsProductId: string;

  constructor(
    secretKey: string,
    webhookSecret: string,
    lmrouterCreditsProductId: string,
  ) {
    this.stripe = new stripe(secretKey);
    this.webhookSecret = webhookSecret;
    this.lmrouterCreditsProductId = lmrouterCreditsProductId;
  }
}
