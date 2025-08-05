import { Hono } from "hono";

import type { Context } from "../../../../types/hono.js";
import { getConfig } from "../../../../utils/config.js";

const modelsRouter = new Hono<Context>();

modelsRouter.get("/:model{.+}", (c) => {
  const cfg = getConfig();
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
    object: "model",
    created: 0,
    owned_by: model.providers.map((provider) => provider.provider).join(", "),
  });
});

modelsRouter.get("/", (c) => {
  const cfg = getConfig();
  const models = Object.entries(cfg.models).map(([name, model]) => {
    return {
      id: name,
      object: "model",
      created: 0,
      owned_by: model.providers.map((provider) => provider.provider).join(", "),
    };
  });

  return c.json({
    object: "list",
    data: models,
  });
});

export default modelsRouter;
