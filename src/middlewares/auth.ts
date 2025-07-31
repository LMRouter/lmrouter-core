import { Request, Response, NextFunction } from "express";

import { getConfig } from "../utils/config.js";

export const auth = (req: Request, res: Response, next: NextFunction) => {
  const apiKey =
    (req.headers["authorization"] as string)?.split(" ")[1] ??
    (req.headers["x-api-key"] as string);
  if (!apiKey) {
    return res.status(401).json({
      error: {
        message: "API key is required",
      },
    });
  }

  const cfg = getConfig();
  if (!cfg.access_keys.includes(apiKey)) {
    return res.status(401).json({
      error: {
        message: "Invalid API key",
      },
    });
  }

  next();
};
