// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import type { User } from "better-auth";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import stripe from "stripe";

import { getConfig, type LMRouterConfigAuthEnabledBilling } from "./config.js";
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
    stripeCache = new StripeClient(cfg.auth.billing);
  }
  return stripeCache;
};

class StripeClient {
  stripe: stripe;
  billingConfig: LMRouterConfigAuthEnabledBilling;

  constructor(billingConfig: LMRouterConfigAuthEnabledBilling) {
    this.stripe = new stripe(billingConfig.stripe.secret_key);
    this.billingConfig = billingConfig;
  }

  async createCheckoutSession(user: User, amount: number, successUrl: string) {
    if (amount < this.billingConfig.credit_minimum) {
      throw new HTTPException(400, {
        message: "Amount is less than the minimum credit amount",
      });
    }

    const customer = await this.stripe.customers.search({
      query: `email:'${user.email}'`,
    });
    let customerId: string;
    if (customer.data.length === 0) {
      const newCustomer = await this.stripe.customers.create({
        email: user.email,
      });
      customerId = newCustomer.id;
    } else {
      customerId = customer.data[0].id;
    }

    return await this.stripe.checkout.sessions.create({
      client_reference_id: user.id,
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product: this.billingConfig.stripe.lmrouter_credits_product_id,
            unit_amount: Math.round(amount * 100),
          },
          quantity: 1,
        },
        {
          price_data: {
            currency: "usd",
            product: this.billingConfig.stripe.lmrouter_fees_product_id,
            unit_amount: Math.round(
              Math.max(
                amount * this.billingConfig.fee_rate,
                this.billingConfig.fee_minimum,
              ) * 100,
            ),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: successUrl,
    });
  }
}
