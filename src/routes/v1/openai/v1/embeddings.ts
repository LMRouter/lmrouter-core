// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { Hono } from "hono";
import type { EmbeddingCreateParams } from "openai/resources";

import { OpenAIEmbeddingsAdapterFactory } from "../../../../adapters/openai/v1/embeddings/adapter.js";
import { requireAuth } from "../../../../middlewares/auth.js";
import { ensureBalance } from "../../../../middlewares/billing.js";
import { parseModel } from "../../../../middlewares/model.js";
import type { ContextEnv } from "../../../../types/hono.js";
import { calculateCost, updateBilling } from "../../../../utils/billing.js";
import { iterateModelProviders } from "../../../../utils/utils.js";

const embeddingsRouter = new Hono<ContextEnv>();

embeddingsRouter.use(requireAuth(), ensureBalance, parseModel);

embeddingsRouter.post("/", async (c) => {
  const body = await c.req.json();
  return await iterateModelProviders(c, async (providerCfg, provider) => {
    const reqBody = { ...body } as EmbeddingCreateParams;
    reqBody.model = providerCfg.model;

    const adapter = OpenAIEmbeddingsAdapterFactory.getAdapter(provider);
    const embeddings = await adapter.sendRequest(provider, reqBody);
    await updateBilling(c, calculateCost(adapter.usage, providerCfg.pricing), {
      type: "api-call",
      data: {
        api_key_id:
          c.var.auth?.type === "api-key" ? c.var.auth.apiKey.id : undefined,
        model: body.model,
        endpoint: c.req.path,
        usage: adapter.usage,
        pricing: providerCfg.pricing,
      },
    });
    return c.json(embeddings);
  });
});

export default embeddingsRouter;
