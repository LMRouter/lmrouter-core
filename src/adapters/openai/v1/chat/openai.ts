// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import OpenAI from "openai";
import { Stream } from "openai/core/streaming";
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsBase,
} from "openai/resources/chat/completions";

import type {
  OpenAIChatCompletionAdapter,
  OpenAIChatCompletionInputOptions,
} from "./adapter.js";
import type {
  LMRouterConfigModelProviderPricing,
  LMRouterConfigProvider,
} from "../../../../utils/config.js";

export class OpenAIChatCompletionOpenAIAdapter
  implements OpenAIChatCompletionAdapter
{
  usage?: LMRouterConfigModelProviderPricing;

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
    request: ChatCompletionCreateParamsBase,
    options?: OpenAIChatCompletionInputOptions,
  ): Promise<ChatCompletion> {
    const openai = this.getClient(provider);
    const completion = await openai.chat.completions.create(request);
    this.usage = {
      input: (completion as ChatCompletion).usage?.prompt_tokens ?? 0,
      output: (completion as ChatCompletion).usage?.completion_tokens ?? 0,
      request: 1,
      input_cache_reads:
        (completion as ChatCompletion).usage?.prompt_tokens_details
          ?.cached_tokens ?? 0,
    };
    return completion as ChatCompletion;
  }

  async *sendRequestStreaming(
    provider: LMRouterConfigProvider,
    request: ChatCompletionCreateParamsBase,
    options?: OpenAIChatCompletionInputOptions,
  ): AsyncGenerator<ChatCompletionChunk> {
    const openai = this.getClient(provider);
    const stream = await openai.chat.completions.create(request);
    for await (const chunk of stream as Stream<ChatCompletionChunk>) {
      if (chunk.usage) {
        this.usage = {
          input: chunk.usage.prompt_tokens,
          output: chunk.usage.completion_tokens,
          request: 1,
          input_cache_reads:
            chunk.usage.prompt_tokens_details?.cached_tokens ?? 0,
        };
      }
      yield chunk;
    }
  }
}
