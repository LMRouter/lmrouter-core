// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";

import { auth } from "./middlewares/auth.js";
import anthropicRouter from "./routes/v1/anthropic.js";
import openaiRouter from "./routes/v1/openai.js";
import v1Router from "./routes/v1.js";
import type { ContextEnv } from "./types/hono.js";
import { getConfig } from "./utils/config.js";
import { getUptime } from "./utils/utils.js";

const app = new Hono<ContextEnv>();

app.use(logger());
app.use((c, next) => {
  const cfg = getConfig(c);
  if (!cfg.auth.enabled || !cfg.auth.better_auth.trusted_origins) {
    return cors()(c, next);
  }
  return cors({
    origin: cfg.auth.better_auth.trusted_origins,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  })(c, next);
});
app.use(auth);

app.get("/", (c) => {
  return c.json({
    message: "Welcome to LMRouter!",
    uptime: getUptime(),
    apis_available: ["v1"],
  });
});

app.route("/anthropic", anthropicRouter);
app.route("/openai", openaiRouter);
app.route("/v1", v1Router);

app.onError((err, c) => {
  console.error(err.stack);
  const cfg = getConfig(c);
  return c.json(
    {
      error: {
        message:
          err instanceof HTTPException ? err.message : "Internal Server Error",
        stack: cfg.server.logging === "dev" ? err.stack : undefined,
      },
    },
    err instanceof HTTPException ? err.status : 500,
  );
});

app.notFound((c) => {
  return c.json(
    {
      error: {
        message: "Not Found",
      },
    },
    404,
  );
});

export default app;
