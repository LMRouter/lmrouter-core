// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { Hono } from "hono";

import { requireAuth } from "../../middlewares/auth.js";
import type { AuthBetterAuth, ContextEnv } from "../../types/hono.js";
import { getStripe } from "../../utils/stripe.js";

const billingRouter = new Hono<ContextEnv>();

billingRouter.use(requireAuth("better-auth"));

billingRouter.post("/checkout", async (c) => {
  const { amount, success_url } = await c.req.json();
  if (typeof amount !== "number" || typeof success_url !== "string") {
    return c.json({ error: "Bad request" }, 400);
  }

  const auth = c.var.auth as AuthBetterAuth;
  const session = await getStripe(c).createCheckoutSession(
    c,
    amount,
    success_url,
  );

  return c.json({ session_url: session.url });
});

export default billingRouter;
