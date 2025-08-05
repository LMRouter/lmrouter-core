import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import OpenAI from "openai";
import { Stream as OpenAIStream } from "openai/core/streaming";
import type {
  ResponseCreateParamsBase,
  ResponseStreamEvent,
} from "openai/resources/responses/responses";

import { auth } from "../../../../middlewares/auth.js";
import type { Context } from "../../../../types/hono.js";
import { getConfig } from "../../../../utils/config.js";

const responsesRouter = new Hono<Context>();

responsesRouter.use(auth);

responsesRouter.post("/", async (c) => {
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

    const reqBody = { ...body } as ResponseCreateParamsBase;
    reqBody.model = provider.model;

    try {
      const response = await openai.responses.create(reqBody);
      if (reqBody.stream !== true) {
        return c.json(response);
      }

      return streamSSE(c, async (stream) => {
        for await (const chunk of response as OpenAIStream<ResponseStreamEvent>) {
          await stream.writeSSE({
            data: JSON.stringify(chunk),
          });
        }
        await stream.writeSSE({
          data: "[DONE]",
        });
      });
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

export default responsesRouter;
