import { Request, Response } from "express";

import { getConfig } from "../../../../utils/config.js";

export const getModel = (req: Request, res: Response) => {
  const cfg = getConfig();
  const modelName = (req.params.model as unknown as string[]).join("/");
  const model = cfg.models[modelName];
  if (!model) {
    return res.status(404).json({
      error: {
        message: "Model not found",
      },
    });
  }

  res.status(200).json({
    id: modelName,
    type: "model",
    display_name: modelName,
    created_at: "1970-01-01T00:00:00Z",
  });
};

export const listModels = (req: Request, res: Response) => {
  const cfg = getConfig();
  const models = Object.keys(cfg.models).map((name) => {
    return {
      id: name,
      type: "model",
      display_name: name,
      created_at: "1970-01-01T00:00:00Z",
    };
  });

  res.status(200).json({
    data: models,
    first_id: models[0].id,
    has_more: false,
    last_id: models[models.length - 1].id,
  });
};
