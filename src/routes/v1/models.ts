// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { Hono } from "hono";

import type {
  LMRouterModelGetResponse,
  LMRouterModelListResponse,
} from "../../types/api.js";
import type { ContextEnv } from "../../types/hono.js";
import { getConfig } from "../../utils/config.js";

const modelsRouter = new Hono<ContextEnv>();

modelsRouter.get("/:model{.+}", (c) => {
  const cfg = getConfig(c);
  const modelName = c.req.param("model");
  const model = cfg.models[modelName];
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

  return c.json({
    id: modelName,
    ...model,
  } as LMRouterModelGetResponse);
});

modelsRouter.get("/", (c) => {
  const cfg = getConfig(c);
  const models = Object.entries(cfg.models).map(([name, model]) => {
    return {
      id: name,
      ...model,
    };
  });

  return c.json({ models } as LMRouterModelListResponse);
});

export default modelsRouter;
