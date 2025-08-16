// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { ResponseCreateParamsBase } from "openai/resources/responses/responses";

import { OpenAIResponsesAdapterFactory } from "../../../../adapters/openai/v1/responses/adapter.js";
import { auth } from "../../../../middlewares/auth.js";
import { parseModel } from "../../../../middlewares/model.js";
import type { ContextEnv } from "../../../../types/hono.js";
import { ResponsesStoreFactory } from "../../../../utils/responses-store.js";
import { iterateModelProviders } from "../../../../utils/utils.js";

const responsesRouter = new Hono<ContextEnv>();

responsesRouter.use(auth, parseModel);

responsesRouter.post("/", async (c) => {
  const body = await c.req.json();
  return await iterateModelProviders(c, async (modelName, provider) => {
    const reqBody = { ...body } as ResponseCreateParamsBase;
    reqBody.model = modelName;

    const adapter = OpenAIResponsesAdapterFactory.getAdapter(provider);
    if (reqBody.stream !== true) {
      const response = await adapter.sendRequest(provider, reqBody, {
        maxTokens: c.var.model!.max_tokens,
      });
      if (reqBody.store !== false) {
        await ResponsesStoreFactory.getStore().set(reqBody, response);
      }
      return c.json(response);
    }

    const s = adapter.sendRequestStreaming(provider, reqBody, {
      maxTokens: c.var.model!.max_tokens,
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
