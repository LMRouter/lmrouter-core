import Anthropic from "@anthropic-ai/sdk";
import { Stream as AnthropicStream } from "@anthropic-ai/sdk/core/streaming";
import type { RawMessageStreamEvent } from "@anthropic-ai/sdk/resources";
import type { MessageCreateParamsBase } from "@anthropic-ai/sdk/resources/messages";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import OpenAI from "openai";
import { Stream as OpenAIStream } from "openai/core/streaming";
import type {
  ChatCompletion,
  ChatCompletionChunk,
} from "openai/resources/chat/completions";

import { chatCompletionAdapters } from "../../../../adapters/chat.js";
import { auth } from "../../../../middlewares/auth.js";
import type { Context } from "../../../../types/hono.js";
import { getConfig } from "../../../../utils/config.js";

const messagesRouter = new Hono<Context>();

messagesRouter.use(auth);

messagesRouter.post("/", async (c) => {
  const body = await c.req.json();
  const cfg = getConfig();
  let model = cfg.models[body.model];
  if (!model) {
    if (!cfg.models["*"]) {
      return c.json(
        {
          error: {
            message: "Model not found",
          },
        },
        404,
      );
    }
    model = {
      providers: cfg.models["*"].providers.map((provider) => ({
        provider: provider.provider,
        model: body.model,
      })),
    };
  }

  let error: any = null;
  for (const provider of model.providers) {
    const providerCfg = cfg.providers[provider.provider];
    if (!providerCfg) {
      continue;
    }

    const reqBody = { ...body } as MessageCreateParamsBase;
    reqBody.model = provider.model;

    try {
      if (providerCfg.type !== "anthropic") {
        const openai = new OpenAI({
          baseURL: providerCfg.base_url,
          apiKey: c.var.byok ?? providerCfg.api_key,
        });

        const completion = await openai.chat.completions.create(
          chatCompletionAdapters.anthropic.requestToOpenai(reqBody),
        );
        if (reqBody.stream !== true) {
          return c.json(
            chatCompletionAdapters.openai.responseToAnthropic(
              completion as ChatCompletion,
            ),
          );
        }
        return streamSSE(c, async (stream) => {
          for await (const chunk of chatCompletionAdapters.openai.streamToAnthropic(
            completion as OpenAIStream<ChatCompletionChunk>,
          )) {
            await stream.writeSSE({
              event: chunk.type,
              data: JSON.stringify(chunk),
            });
          }
        });
      }

      const anthropic = new Anthropic({
        baseURL: providerCfg.base_url,
        apiKey: c.var.byok ?? providerCfg.api_key,
      });

      const completion = await anthropic.messages.create(reqBody);

      if (reqBody.stream !== true) {
        return c.json(completion);
      }

      return streamSSE(c, async (stream) => {
        for await (const chunk of completion as AnthropicStream<RawMessageStreamEvent>) {
          await stream.writeSSE({
            event: chunk.type,
            data: JSON.stringify(chunk),
          });
        }
      });
    } catch (e) {
      error = e;
      if (cfg.server.logging === "dev") {
        console.error(error);
      }
    }
  }

  if (error) {
    return c.json(
      {
        error: error.error,
      },
      error.status || 500,
    );
  }

  return c.json(
    {
      error: {
        message: "All providers failed to complete the request",
      },
    },
    500,
  );
});

export default messagesRouter;
