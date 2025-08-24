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
import type {
  LMRouterConfigModelProviderPricing,
  LMRouterConfigProvider,
} from "../../../../utils/config.js";

export class OpenAIResponsesOpenAIAdapter implements OpenAIResponsesAdapter {
  usage?: LMRouterConfigModelProviderPricing;
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
    this.usage = {
      input: (response as Response).usage?.input_tokens ?? 0,
      output: (response as Response).usage?.output_tokens ?? 0,
      request: 1,
      input_cache_reads:
        (response as Response).usage?.input_tokens_details.cached_tokens ?? 0,
    };
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
        this.usage = {
          input: chunk.response.usage?.input_tokens ?? 0,
          output: chunk.response.usage?.output_tokens ?? 0,
          request: 1,
          input_cache_reads:
            chunk.response.usage?.input_tokens_details.cached_tokens ?? 0,
        };
        this.response = chunk.response;
      }
      yield chunk;
    }
  }
}
