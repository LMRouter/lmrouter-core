// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { TranscriptionCreateParamsBase } from "openai/resources/audio/transcriptions";

import { OpenAITranscriptionsAdapterFactory } from "../../../../adapters/openai/v1/audio/transcriptions/adapter.js";
import { requireAuth } from "../../../../middlewares/auth.js";
import { ensureBalance } from "../../../../middlewares/billing.js";
import { parseModel } from "../../../../middlewares/model.js";
import type { ContextEnv } from "../../../../types/hono.js";
import { recordApiCall } from "../../../../utils/billing.js";
import { TimeKeeper } from "../../../../utils/chrono.js";
import { iterateModelProviders } from "../../../../utils/utils.js";

const audioRouter = new Hono<ContextEnv>();

audioRouter.use(requireAuth(), ensureBalance, parseModel);

audioRouter.post("/transcriptions", async (c) => {
  const formData = await c.req.formData();
  const body: Record<string, any> = {};
  for (const [key, value] of formData.entries()) {
    if (key === "include[]") {
      if (!Array.isArray(body.include)) {
        body.include = [];
      }
      body.include.push(value);
    } else if (key === "timestamp_granularities[]") {
      if (!Array.isArray(body.timestamp_granularities)) {
        body.timestamp_granularities = [];
      }
      body.timestamp_granularities.push(value);
    } else {
      body[key] = value;
    }
  }

  if (body.response_format && body.response_format !== "json") {
    return c.json(
      {
        error: {
          message: `Response format ${body.response_format} is not supported`,
        },
      },
      400,
    );
  }

  return await iterateModelProviders(c, async (providerCfg, provider) => {
    const reqBody = { ...body } as TranscriptionCreateParamsBase;
    reqBody.model = providerCfg.model;

    const adapter = OpenAITranscriptionsAdapterFactory.getAdapter(provider);
    const timeKeeper = new TimeKeeper();
    timeKeeper.record();
    if ((reqBody.stream as unknown as string) !== "true") {
      const transcription = await adapter.sendRequest(provider, reqBody);
      timeKeeper.record();
      await recordApiCall(
        c,
        providerCfg.provider,
        200,
        timeKeeper.timestamps(),
        adapter.usage,
        providerCfg.pricing,
      );
      return c.json(transcription);
    }

    const s = await adapter.sendRequestStreaming(provider, reqBody);
    return streamSSE(c, async (stream) => {
      for await (const chunk of s) {
        timeKeeper.record();
        await stream.writeSSE({
          data: JSON.stringify(chunk),
        });
      }
      await stream.writeSSE({
        data: "[DONE]",
      });
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

export default audioRouter;
