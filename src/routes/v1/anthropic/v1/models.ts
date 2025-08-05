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
    type: "model",
    display_name: modelName,
    created_at: "1970-01-01T00:00:00Z",
  });
});

modelsRouter.get("/", (c) => {
  const cfg = getConfig();
  const models = Object.keys(cfg.models).map((name) => {
    return {
      id: name,
      type: "model",
      display_name: name,
      created_at: "1970-01-01T00:00:00Z",
    };
  });

  return c.json({
    data: models,
    first_id: models.length > 0 ? models[0].id : null,
    has_more: false,
    last_id: models.length > 0 ? models[models.length - 1].id : null,
  });
});

export default modelsRouter;
