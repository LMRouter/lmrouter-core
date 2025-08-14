// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { ResponseCreateParamsBase } from "openai/resources/responses/responses";

import { OpenAIResponsesAdapterFactory } from "../../../../adapters/openai/v1/responses/adapter.js";
import { auth } from "../../../../middlewares/auth.js";
import type { Context } from "../../../../types/hono.js";
import { ResponsesStoreFactory } from "../../../../utils/responses-store.js";
import { getModel, iterateModelProviders } from "../../../../utils/utils.js";

const responsesRouter = new Hono<Context>();

responsesRouter.use(auth);

responsesRouter.post("/", async (c) => {
  const body = await c.req.json();
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

  return await iterateModelProviders(model, c, async (modelName, provider) => {
    const reqBody = { ...body } as ResponseCreateParamsBase;
    reqBody.model = modelName;

    const adapter = OpenAIResponsesAdapterFactory.getAdapter(provider);
    if (reqBody.stream !== true) {
      const response = await adapter.sendRequest(provider, reqBody, {
        maxTokens: model.max_tokens,
      });
      if (reqBody.store !== false) {
        await ResponsesStoreFactory.getStore().set(reqBody, response);
      }
      return c.json(response);
    }

    const s = adapter.sendRequestStreaming(provider, reqBody, {
      maxTokens: model.max_tokens,
    });
    return streamSSE(c, async (stream) => {
      for await (const chunk of s) {
        await stream.writeSSE({
          event: chunk.type,
          data: JSON.stringify(chunk),
        });
      }
      if (reqBody.store !== false && adapter.response) {
        await ResponsesStoreFactory.getStore().set(reqBody, adapter.response);
      }
    });
  });
});

export default responsesRouter;
