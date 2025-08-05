import Anthropic from "@anthropic-ai/sdk";
import { Stream as AnthropicStream } from "@anthropic-ai/sdk/core/streaming";
import type {
  Message,
  RawMessageStreamEvent,
} from "@anthropic-ai/sdk/resources";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import OpenAI from "openai";
import { Stream as OpenAIStream } from "openai/core/streaming";
import type {
  ChatCompletionChunk,
  ChatCompletionCreateParamsBase,
} from "openai/resources/chat/completions";

import { chatCompletionAdapters } from "../../../../adapters/chat.js";
import { auth } from "../../../../middlewares/auth.js";
import type { Context } from "../../../../types/hono.js";
import { getConfig } from "../../../../utils/config.js";

const chatRouter = new Hono<Context>();

chatRouter.use(auth);

chatRouter.post("/completions", async (c) => {
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

    const reqBody = { ...body } as ChatCompletionCreateParamsBase;
    reqBody.model = provider.model;
    if (reqBody.stream === true) {
      reqBody.stream_options = {
        include_usage: true,
      };
    }

    try {
      if (providerCfg.type !== "anthropic") {
        const openai = new OpenAI({
          baseURL: providerCfg.base_url,
          apiKey: c.var.byok ?? providerCfg.api_key,
        });

        const completion = await openai.chat.completions.create(reqBody);
        if (reqBody.stream !== true) {
          return c.json(completion);
        }

        return streamSSE(c, async (stream) => {
          for await (const chunk of completion as OpenAIStream<ChatCompletionChunk>) {
            await stream.writeSSE({
              data: JSON.stringify(chunk),
            });
          }
          await stream.writeSSE({
            data: "[DONE]",
          });
        });
      }

      const anthropic = new Anthropic({
        baseURL: providerCfg.base_url,
        apiKey: c.var.byok ?? providerCfg.api_key,
      });

      const completion = await anthropic.messages.create(
        chatCompletionAdapters.openai.requestToAnthropic(
          reqBody,
          model.max_tokens,
        ),
      );

      if (reqBody.stream !== true) {
        return c.json(
          chatCompletionAdapters.anthropic.responseToOpenai(
            completion as Message,
          ),
        );
      }

      return streamSSE(c, async (stream) => {
        for await (const chunk of chatCompletionAdapters.anthropic.streamToOpenai(
          completion as AnthropicStream<RawMessageStreamEvent>,
        )) {
          await stream.writeSSE({
            data: JSON.stringify(chunk),
          });
        }
        await stream.writeSSE({
          data: "[DONE]",
        });
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

export default chatRouter;
