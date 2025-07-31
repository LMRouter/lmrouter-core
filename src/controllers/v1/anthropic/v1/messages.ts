import Anthropic from "@anthropic-ai/sdk";
import { Stream as AnthropicStream } from "@anthropic-ai/sdk/core/streaming";
import { RawMessageStreamEvent } from "@anthropic-ai/sdk/resources";
import { MessageCreateParamsBase } from "@anthropic-ai/sdk/resources/messages";
import { Request, Response } from "express";
import OpenAI from "openai";
import { Stream as OpenAIStream } from "openai/core/streaming";
import {
  ChatCompletion,
  ChatCompletionChunk,
} from "openai/resources/chat/completions";

import { chatCompletionAdapters } from "../../../../adapters/chat.js";
import { getConfig } from "../../../../utils/config.js";

export const createMessage = async (req: Request, res: Response) => {
  const cfg = getConfig();
  const model = cfg.models[req.body.model];
  if (!model) {
    return res.status(404).json({
      error: {
        message: "Model not found",
      },
    });
  }

  let error: any = null;
  for (const provider of model.providers) {
    const providerCfg = cfg.providers[provider.provider];
    if (!providerCfg) {
      continue;
    }

    const reqBody = { ...req.body } as MessageCreateParamsBase;
    reqBody.model = provider.model;

    try {
      if (providerCfg.type !== "anthropic") {
        const openai = new OpenAI({
          baseURL: providerCfg.base_url,
          apiKey: providerCfg.api_key,
        });

        const completion = await openai.chat.completions.create(
          chatCompletionAdapters.anthropic.requestToOpenai(reqBody),
        );
        if (reqBody.stream !== true) {
          res
            .status(200)
            .json(
              chatCompletionAdapters.openai.responseToAnthropic(
                completion as ChatCompletion,
              ),
            );
          return;
        }

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        for await (const chunk of chatCompletionAdapters.openai.streamToAnthropic(
          completion as OpenAIStream<ChatCompletionChunk>,
        )) {
          res.write(`event: ${chunk.type}\ndata: ${JSON.stringify(chunk)}\n\n`);
        }

        res.end();
        return;
      }

      const anthropic = new Anthropic({
        baseURL: providerCfg.base_url,
        apiKey: providerCfg.api_key,
      });

      const completion = await anthropic.messages.create(reqBody);

      if (reqBody.stream !== true) {
        res.status(200).json(completion);
        return;
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      for await (const chunk of completion as AnthropicStream<RawMessageStreamEvent>) {
        res.write(`event: ${chunk.type}\ndata: ${JSON.stringify(chunk)}\n\n`);
      }

      res.end();
      return;
    } catch (e) {
      error = e;
      if (cfg.server.logging === "dev") {
        console.error(error);
      }
    }
  }

  if (error) {
    return res.status(error.status).json({
      error: error.error,
    });
  }

  return res.status(500).json({
    error: {
      message: "All providers failed to complete the request",
    },
  });
};
