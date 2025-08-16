// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { createMiddleware } from "hono/factory";

import type { ContextEnv } from "../types/hono.js";
import { getModel } from "../utils/utils.js";

export const parseModel = createMiddleware<ContextEnv>(async (c, next) => {
  const body = await c.req.json();
  if (!body.model) {
    return c.json(
      {
        error: {
          message: "Model is required",
        },
      },
      400,
    );
  }

  const model = getModel(body.model, c);
  if (!model) {
    return c.json(
      {
        error: {
          message: "Model not found",
        },
      },
      404,
    );
  }
  c.set("model", model);

  await next();
});
