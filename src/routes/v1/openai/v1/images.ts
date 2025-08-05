import { Hono } from "hono";
import OpenAI from "openai";

import { auth } from "../../../../middlewares/auth.js";
import type { Context } from "../../../../types/hono.js";
import { getConfig } from "../../../../utils/config.js";

const imagesRouter = new Hono<Context>();

imagesRouter.use(auth);

imagesRouter.post("/generations", async (c) => {
  const body = await c.req.json();
  const cfg = getConfig();
  const model = cfg.models[body.model];
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

  let error: any = null;
  for (const provider of model.providers) {
    const providerCfg = cfg.providers[provider.provider];
    if (!providerCfg) {
      continue;
    }

    const openai = new OpenAI({
      baseURL: providerCfg.base_url,
      apiKey: c.var.byok ?? providerCfg.api_key,
    });

    const reqBody = { ...body };
    reqBody.model = provider.model;

    try {
      const image = await openai.images.generate(reqBody);
      return c.json(image);
    } catch (e) {
      error = e;
      if (cfg.server.logging === "dev") {
        console.error(error);
      }
    }
  }

  if (error) {
    return c.json(
      {
        error: error.error,
      },
      error.status || 500,
    );
  }

  return c.json(
    {
      error: {
        message: "All providers failed to complete the request",
      },
    },
    500,
  );
});

imagesRouter.post("/edits", async (c) => {
  const body = await c.req.json();
  const cfg = getConfig();
  const model = cfg.models[body.model];
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

  let error: any = null;
  for (const provider of model.providers) {
    const providerCfg = cfg.providers[provider.provider];
    if (!providerCfg) {
      continue;
    }

    const openai = new OpenAI({
      baseURL: providerCfg.base_url,
      apiKey: c.var.byok ?? providerCfg.api_key,
    });

    const reqBody = { ...body };
    reqBody.model = provider.model;

    try {
      const image = await openai.images.edit(reqBody);
      return c.json(image);
    } catch (e) {
      error = e;
      if (cfg.server.logging === "dev") {
        console.error(error);
      }
    }
  }

  if (error) {
    return c.json(
      {
        error: error.error,
      },
      error.status || 500,
    );
  }

  return c.json(
    {
      error: {
        message: "All providers failed to complete the request",
      },
    },
    500,
  );
});

export default imagesRouter;
