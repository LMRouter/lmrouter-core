// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions";

import { OpenAIChatCompletionAdapterFactory } from "../../../../adapters/openai/v1/chat/adapter.js";
import { requireAuth } from "../../../../middlewares/auth.js";
import { ensureBalance } from "../../../../middlewares/billing.js";
import { parseModel } from "../../../../middlewares/model.js";
import type { ContextEnv } from "../../../../types/hono.js";
import { iterateModelProviders } from "../../../../utils/utils.js";

const chatRouter = new Hono<ContextEnv>();

chatRouter.use(requireAuth(), ensureBalance, parseModel);

chatRouter.post("/completions", async (c) => {
  const body = await c.req.json();
  return await iterateModelProviders(c, async (providerCfg, provider) => {
    const reqBody = { ...body } as ChatCompletionCreateParamsBase;
    reqBody.model = providerCfg.model;
    if (reqBody.stream === true) {
      reqBody.stream_options = {
        include_usage: true,
      };
    }

    const adapter = OpenAIChatCompletionAdapterFactory.getAdapter(provider);
    if (reqBody.stream !== true) {
      const completion = await adapter.sendRequest(provider, reqBody, {
        maxTokens: providerCfg.max_tokens,
      });
      return c.json(completion);
    }

    const s = adapter.sendRequestStreaming(provider, reqBody, {
      maxTokens: providerCfg.max_tokens,
    });
    return streamSSE(c, async (stream) => {
      for await (const chunk of s) {
        await stream.writeSSE({
          data: JSON.stringify(chunk),
        });
      }
      await stream.writeSSE({
        data: "[DONE]",
      });
    });
  });
});

export default chatRouter;
