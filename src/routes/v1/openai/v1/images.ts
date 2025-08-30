// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type {
  ImageEditParamsBase,
  ImageGenerateParamsBase,
} from "openai/resources/images";

import { OpenAIImageEditAdapterFactory } from "../../../../adapters/openai/v1/images/edits/adapter.js";
import { OpenAIImageGenerationAdapterFactory } from "../../../../adapters/openai/v1/images/generations/adapter.js";
import { requireAuth } from "../../../../middlewares/auth.js";
import { ensureBalance } from "../../../../middlewares/billing.js";
import { parseModel } from "../../../../middlewares/model.js";
import type { ContextEnv } from "../../../../types/hono.js";
import { recordApiCall } from "../../../../utils/billing.js";
import { TimeKeeper } from "../../../../utils/chrono.js";
import { iterateModelProviders } from "../../../../utils/utils.js";

const imagesRouter = new Hono<ContextEnv>();

imagesRouter.use(requireAuth(), ensureBalance, parseModel);

imagesRouter.post("/generations", async (c) => {
  const body = await c.req.json();
  return await iterateModelProviders(c, async (providerCfg, provider) => {
    const reqBody = { ...body } as ImageGenerateParamsBase;
    reqBody.model = providerCfg.model;

    const adapter = OpenAIImageGenerationAdapterFactory.getAdapter(provider);
    const timeKeeper = new TimeKeeper();
    timeKeeper.record();
    if (reqBody.stream !== true) {
      const image = await adapter.sendRequest(provider, reqBody);
      timeKeeper.record();
      await recordApiCall(
        c,
        providerCfg.provider,
        200,
        timeKeeper.timestamps(),
        adapter.usage,
        providerCfg.pricing,
      );
      return c.json(image);
    }

    const s = await adapter.sendRequestStreaming(provider, reqBody);
    return streamSSE(c, async (stream) => {
      for await (const chunk of s) {
        timeKeeper.record();
        await stream.writeSSE({
          event: chunk.type,
          data: JSON.stringify(chunk),
        });
        await recordApiCall(
          c,
          providerCfg.provider,
          200,
          timeKeeper.timestamps(),
          adapter.usage,
          providerCfg.pricing,
        );
      }
    });
  });
});

imagesRouter.post("/edits", async (c) => {
  const formData = await c.req.formData();
  const body: Record<string, any> = {};
  for (const [key, value] of formData.entries()) {
    if (key === "image[]") {
      if (!Array.isArray(body.image)) {
        body.image = [];
      }
      body.image.push(value);
    } else {
      body[key] = value;
    }
  }

  return await iterateModelProviders(c, async (providerCfg, provider) => {
    const reqBody = { ...body } as ImageEditParamsBase;
    reqBody.model = providerCfg.model;

    const adapter = OpenAIImageEditAdapterFactory.getAdapter(provider);
    const timeKeeper = new TimeKeeper();
    timeKeeper.record();
    if ((reqBody.stream as unknown as string) !== "true") {
      const image = await adapter.sendRequest(provider, reqBody);
      timeKeeper.record();
      await recordApiCall(
        c,
        providerCfg.provider,
        200,
        timeKeeper.timestamps(),
        adapter.usage,
        providerCfg.pricing,
      );
      return c.json(image);
    }

    const s = await adapter.sendRequestStreaming(provider, reqBody);
    return streamSSE(c, async (stream) => {
      for await (const chunk of s) {
        timeKeeper.record();
        await stream.writeSSE({
          event: chunk.type,
          data: JSON.stringify(chunk),
        });
        await recordApiCall(
          c,
          providerCfg.provider,
          200,
          timeKeeper.timestamps(),
          adapter.usage,
          providerCfg.pricing,
        );
      }
    });
  });
});

export default imagesRouter;
