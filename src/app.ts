// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import rootAnthropicRouter from "./routes/anthropic.js";
import rootOpenaiRouter from "./routes/openai.js";
import v1Router from "./routes/v1.js";
import type { Context } from "./types/hono.js";
import { getConfig } from "./utils/config.js";
import { getUptime } from "./utils/utils.js";

const app = new Hono<Context>();

app.use(logger());
app.use(cors());

app.get("/", (c) => {
  return c.json({
    message: "Welcome to LMRouter Core!",
    uptime: getUptime(),
    apis_available: ["v1"],
  });
});

app.route("/anthropic", rootAnthropicRouter);
app.route("/openai", rootOpenaiRouter);
app.route("/v1", v1Router);

app.onError((err, c) => {
  console.error(err.stack);
  const cfg = getConfig(c);
  return c.json(
    {
      error: {
        message: "Internal Server Error",
        stack: cfg.server.logging === "dev" ? err.stack : undefined,
      },
    },
    500,
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
