// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import OpenAI from "openai";
import { Stream } from "openai/core/streaming";
import type {
  Response,
  ResponseCreateParamsBase,
  ResponseStreamEvent,
} from "openai/resources/responses/responses";

import type {
  OpenAIResponsesAdapter,
  OpenAIResponsesInputOptions,
} from "./adapter.js";
import type { LMRouterConfigProvider } from "../../../../utils/config.js";

export class OpenAIResponsesOpenAIAdapter implements OpenAIResponsesAdapter {
  response?: Response;

  getClient(provider: LMRouterConfigProvider): OpenAI {
    return new OpenAI({
      baseURL: provider.base_url,
      apiKey: provider.api_key,
      defaultHeaders: {
        "HTTP-Referer": "https://lmrouter.com/",
        "X-Title": "LMRouter",
      },
    });
  }

  async sendRequest(
    provider: LMRouterConfigProvider,
    request: ResponseCreateParamsBase,
    options?: OpenAIResponsesInputOptions,
  ): Promise<Response> {
    const openai = this.getClient(provider);
    const response = await openai.responses.create(request);
    return response as Response;
  }

  async *sendRequestStreaming(
    provider: LMRouterConfigProvider,
    request: ResponseCreateParamsBase,
    options?: OpenAIResponsesInputOptions,
  ): AsyncGenerator<ResponseStreamEvent> {
    const openai = this.getClient(provider);
    const stream = await openai.responses.create(request);
    for await (const chunk of stream as Stream<ResponseStreamEvent>) {
      if (chunk.type === "response.completed") {
        this.response = chunk.response;
      }
      yield chunk;
    }
  }
}
