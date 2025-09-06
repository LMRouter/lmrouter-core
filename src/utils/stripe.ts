// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { eq } from "drizzle-orm";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import stripe from "stripe";

import { getConfig } from "./config.js";
import { getDb } from "./database.js";
import { user as userModel } from "../models/auth.js";
import type { LMRouterConfigAuthEnabledBilling } from "../types/config.js";
import type { AuthBetterAuth, ContextEnv } from "../types/hono.js";

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

  async createCheckoutSession(
    c: Context<ContextEnv>,
    amount: number,
    successUrl: string,
  ) {
    if (amount < this.billingConfig.credit_minimum) {
      throw new HTTPException(400, {
        message: "Amount is less than the minimum credit amount",
      });
    }

    const auth = c.var.auth as AuthBetterAuth;
    const userStripeData = await getDb(c)
      .select({
        stripe_customer_id: userModel.stripeCustomerId,
      })
      .from(userModel)
      .where(eq(userModel.id, auth.ownerId));
    if (userStripeData.length === 0) {
      throw new HTTPException(500, {
        message: "Internal server error",
      });
    }

    let customerId: string;
    if (!userStripeData[0].stripe_customer_id) {
      const newCustomer = await this.stripe.customers.create({
        email: auth.user.email,
      });
      await getDb(c)
        .update(userModel)
        .set({
          stripeCustomerId: newCustomer.id,
        })
        .where(eq(userModel.id, auth.ownerId));
      customerId = newCustomer.id;
    } else {
      customerId = userStripeData[0].stripe_customer_id;
    }

    return await this.stripe.checkout.sessions.create({
      client_reference_id: auth.ownerId,
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
                amount * this.billingConfig.fee_rate +
                  this.billingConfig.fee_flat,
                this.billingConfig.fee_minimum,
              ) * 100,
            ),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: successUrl,
      metadata: {
        owner_type: auth.ownerType,
        owner_id: auth.ownerId,
        amount,
      },
    });
  }
}
