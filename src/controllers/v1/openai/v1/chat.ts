import Anthropic from "@anthropic-ai/sdk";
import { Stream as AnthropicStream } from "@anthropic-ai/sdk/core/streaming";
import { Message, RawMessageStreamEvent } from "@anthropic-ai/sdk/resources";
import { Request, Response } from "express";
import OpenAI from "openai";
import { Stream as OpenAIStream } from "openai/core/streaming";
import {
  ChatCompletionChunk,
  ChatCompletionCreateParamsBase,
} from "openai/resources/chat/completions";
import {
  ResponseCreateParamsBase,
  ResponseStreamEvent,
} from "openai/resources/responses/responses";

import { chatCompletionAdapters } from "../../../../adapters/chat.js";
import { getConfig } from "../../../../utils/config.js";

export const createChatCompletion = async (req: Request, res: Response) => {
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

    const reqBody = { ...req.body } as ChatCompletionCreateParamsBase;
    reqBody.model = provider.model;

    try {
      if (providerCfg.type !== "anthropic") {
        const openai = new OpenAI({
          baseURL: providerCfg.base_url,
          apiKey: providerCfg.api_key,
        });

        const completion = await openai.chat.completions.create(reqBody);
        if (reqBody.stream !== true) {
          res.status(200).json(completion);
          return;
        }

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");

        for await (const chunk of completion as OpenAIStream<ChatCompletionChunk>) {
          res.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }
        res.write(`data: [DONE]\n\n`);

        res.end();
        return;
      }

      const anthropic = new Anthropic({
        baseURL: providerCfg.base_url,
        apiKey: providerCfg.api_key,
      });

      const completion = await anthropic.messages.create(
        chatCompletionAdapters.openai.requestToAnthropic(
          reqBody,
          model.max_tokens,
        ),
      );

      if (reqBody.stream !== true) {
        res
          .status(200)
          .json(
            chatCompletionAdapters.anthropic.responseToOpenai(
              completion as Message,
            ),
          );
        return;
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      for await (const chunk of chatCompletionAdapters.anthropic.streamToOpenai(
        completion as AnthropicStream<RawMessageStreamEvent>,
      )) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.write(`data: [DONE]\n\n`);

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

export const createResponse = async (req: Request, res: Response) => {
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

    const openai = new OpenAI({
      baseURL: providerCfg.base_url,
      apiKey: providerCfg.api_key,
    });

    const reqBody = { ...req.body } as ResponseCreateParamsBase;
    reqBody.model = provider.model;

    try {
      const response = await openai.responses.create(reqBody);
      if (reqBody.stream !== true) {
        res.status(200).json(response);
        return;
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      for await (const chunk of response as OpenAIStream<ResponseStreamEvent>) {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
      res.write(`data: [DONE]\n\n`);

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
