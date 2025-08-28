// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { createMiddleware } from "hono/factory";

import type { ContextEnv } from "../types/hono.js";
import { getModel } from "../utils/utils.js";

export const parseModel = createMiddleware<ContextEnv>(async (c, next) => {
  let body: Record<string, any> = {};
  if (c.req.header("content-type")?.includes("application/json")) {
    body = await c.req.json();
  } else {
    const formData = await c.req.formData();
    for (const [key, value] of formData.entries()) {
      body[key] = value;
    }
  }

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
  c.set("modelName", body.model);
  c.set("model", model);

  await next();
});
