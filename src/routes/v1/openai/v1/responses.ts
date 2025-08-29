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
import { recordApiCall } from "../../../../utils/billing.js";
import { TimeKeeper } from "../../../../utils/chrono.js";
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
    const timeKeeper = new TimeKeeper();
    timeKeeper.record();
    if (reqBody.stream !== true) {
      const response = await adapter.sendRequest(provider, reqBody, {
        maxTokens: providerCfg.max_tokens,
      });
      timeKeeper.record();
      if (reqBody.store !== false) {
        await ResponsesStoreFactory.getStore().set(reqBody, response);
      }
      await recordApiCall(
        c,
        providerCfg.provider,
        200,
        timeKeeper.timestamps(),
        adapter.usage,
        providerCfg.pricing,
      );
      return c.json(response);
    }

    const s = adapter.sendRequestStreaming(provider, reqBody, {
      maxTokens: providerCfg.max_tokens,
    });
    return streamSSE(c, async (stream) => {
      for await (const chunk of s) {
        timeKeeper.record();
        await stream.writeSSE({
          event: chunk.type,
          data: JSON.stringify(chunk),
        });
      }
      if (reqBody.store !== false && adapter.response) {
        await ResponsesStoreFactory.getStore().set(reqBody, adapter.response);
      }
      await recordApiCall(
        c,
        providerCfg.provider,
        200,
        timeKeeper.timestamps(),
        adapter.usage,
        providerCfg.pricing,
      );
    });
  });
});

export default responsesRouter;
