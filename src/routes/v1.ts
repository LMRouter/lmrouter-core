// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { Hono } from "hono";

import { requireAuth } from "../middlewares/auth.js";
import type { AuthBetterAuth, ContextEnv } from "../types/hono.js";
import { getAuth } from "../utils/auth.js";
import { getConfig } from "../utils/config.js";
import anthropicRouter from "./v1/anthropic.js";
import apiKeysRouter from "./v1/api-keys.js";
import openaiRouter from "./v1/openai.js";

const v1Router = new Hono<ContextEnv>();

v1Router.route("/anthropic", anthropicRouter);

v1Router.on(["GET", "POST"], "/auth/**", (c) => {
  const cfg = getConfig(c);
  if (!cfg.auth.enabled) {
    return c.json(
      {
        error: {
          message: "Auth is not enabled",
        },
      },
      400,
    );
  }
  return getAuth(c).handler(c.req.raw);
});

v1Router.route("/api-keys", apiKeysRouter);

v1Router.route("/openai", openaiRouter);

v1Router.get("/session", requireAuth("better-auth"), (c) => {
  const auth = c.var.auth as AuthBetterAuth;
  return c.json({
    session: auth.session,
    user: auth.user,
  });
});

export default v1Router;
