// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import type { MessageCreateParamsBase } from "@anthropic-ai/sdk/resources/messages";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

import { AnthropicMessagesAdapterFactory } from "../../../../adapters/anthropic/v1/messages/adapter.js";
import { requireAuth } from "../../../../middlewares/auth.js";
import { ensureBalance } from "../../../../middlewares/billing.js";
import { parseModel } from "../../../../middlewares/model.js";
import type { ContextEnv } from "../../../../types/hono.js";
import { iterateModelProviders } from "../../../../utils/utils.js";

const messagesRouter = new Hono<ContextEnv>();

messagesRouter.use(requireAuth(), ensureBalance, parseModel);

messagesRouter.post("/", async (c) => {
  const body = await c.req.json();
  return await iterateModelProviders(c, async (providerCfg, provider) => {
    const reqBody = { ...body } as MessageCreateParamsBase;
    reqBody.model = providerCfg.model;

    const adapter = AnthropicMessagesAdapterFactory.getAdapter(provider);
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
          event: chunk.type,
          data: JSON.stringify(chunk),
        });
      }
    });
  });
});

export default messagesRouter;
