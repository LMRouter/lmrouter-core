// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { Hono } from "hono";
import type { EmbeddingCreateParams } from "openai/resources";

import { OpenAIEmbeddingsAdapterFactory } from "../../../../adapters/openai/v1/embeddings/adapter.js";
import { auth } from "../../../../middlewares/auth.js";
import { parseModel } from "../../../../middlewares/model.js";
import type { ContextEnv } from "../../../../types/hono.js";
import { iterateModelProviders } from "../../../../utils/utils.js";

const embeddingsRouter = new Hono<ContextEnv>();

embeddingsRouter.use(auth, parseModel);

embeddingsRouter.post("/", async (c) => {
  const body = await c.req.json();
  return await iterateModelProviders(c, async (modelName, provider) => {
    const reqBody = { ...body } as EmbeddingCreateParams;
    reqBody.model = modelName;

    const adapter = OpenAIEmbeddingsAdapterFactory.getAdapter(provider);
    const embeddings = await adapter.sendRequest(provider, reqBody);
    return c.json(embeddings);
  });
});

export default embeddingsRouter;
