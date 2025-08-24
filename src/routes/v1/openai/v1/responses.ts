// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { ResponseCreateParamsBase } from "openai/resources/responses/responses";

import { OpenAIResponsesAdapterFactory } from "../../../../adapters/openai/v1/responses/adapter.js";
import { requireAuth } from "../../../../middlewares/auth.js";
import { ensureBalance } from "../../../../middlewares/billing.js";
import { parseModel } from "../../../../middlewares/model.js";
import type { ContextEnv } from "../../../../types/hono.js";
import { calculateCost, updateBilling } from "../../../../utils/billing.js";
import { ResponsesStoreFactory } from "../../../../utils/responses-store.js";
import { iterateModelProviders } from "../../../../utils/utils.js";

const responsesRouter = new Hono<ContextEnv>();

responsesRouter.use(requireAuth(), ensureBalance, parseModel);

responsesRouter.post("/", async (c) => {
  const body = await c.req.json();
  return await iterateModelProviders(c, async (providerCfg, provider) => {
    const reqBody = { ...body } as ResponseCreateParamsBase;
    reqBody.model = providerCfg.model;

    const adapter = OpenAIResponsesAdapterFactory.getAdapter(provider);
    if (reqBody.stream !== true) {
      const response = await adapter.sendRequest(provider, reqBody, {
        maxTokens: providerCfg.max_tokens,
      });
      if (reqBody.store !== false) {
        await ResponsesStoreFactory.getStore().set(reqBody, response);
      }
      await updateBilling(
        c,
        calculateCost(adapter.usage, providerCfg.pricing),
        {
          type: "api-call",
          data: {
            api_key_id:
              c.var.auth?.type === "api-key" ? c.var.auth.apiKey.id : undefined,
            model: body.model,
            endpoint: c.req.path,
            usage: adapter.usage,
            pricing: providerCfg.pricing,
          },
        },
      );
      return c.json(response);
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
      if (reqBody.store !== false && adapter.response) {
        await ResponsesStoreFactory.getStore().set(reqBody, adapter.response);
      }
      await updateBilling(
        c,
        calculateCost(adapter.usage, providerCfg.pricing),
        {
          type: "api-call",
          data: {
            api_key_id:
              c.var.auth?.type === "api-key" ? c.var.auth.apiKey.id : undefined,
            model: body.model,
            endpoint: c.req.path,
            usage: adapter.usage,
            pricing: providerCfg.pricing,
          },
        },
      );
    });
  });
});

export default responsesRouter;
