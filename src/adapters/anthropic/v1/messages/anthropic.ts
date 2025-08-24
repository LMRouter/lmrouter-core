// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import Anthropic from "@anthropic-ai/sdk";
import { Stream } from "@anthropic-ai/sdk/core/streaming";
import type {
  Message,
  MessageCreateParamsBase,
  RawMessageStreamEvent,
} from "@anthropic-ai/sdk/resources/messages";

import type {
  AnthropicMessagesAdapter,
  AnthropicMessagesInputOptions,
} from "./adapter.js";
import type {
  LMRouterConfigModelProviderPricing,
  LMRouterConfigProvider,
} from "../../../../utils/config.js";

export class AnthropicMessagesAnthropicAdapter
  implements AnthropicMessagesAdapter
{
  usage?: LMRouterConfigModelProviderPricing;

  getClient(provider: LMRouterConfigProvider): Anthropic {
    return new Anthropic({
      baseURL: provider.base_url,
      apiKey: provider.api_key,
      timeout: 3600000,
    });
  }

  async sendRequest(
    provider: LMRouterConfigProvider,
    request: MessageCreateParamsBase,
    options?: AnthropicMessagesInputOptions,
  ): Promise<Message> {
    const anthropic = this.getClient(provider);
    const message = await anthropic.messages.create(request);
    this.usage = {
      input: (message as Message).usage.input_tokens,
      output: (message as Message).usage.output_tokens,
      request: 1,
      input_cache_reads:
        (message as Message).usage.cache_read_input_tokens ?? 0,
      input_cache_writes:
        (message as Message).usage.cache_creation_input_tokens ?? 0,
    };
    return message as Message;
  }

  async *sendRequestStreaming(
    provider: LMRouterConfigProvider,
    request: MessageCreateParamsBase,
    options?: AnthropicMessagesInputOptions,
  ): AsyncGenerator<RawMessageStreamEvent> {
    const anthropic = this.getClient(provider);
    const stream = await anthropic.messages.create(request);
    for await (const chunk of stream as Stream<RawMessageStreamEvent>) {
      if (chunk.type === "message_delta") {
        this.usage = {
          input: chunk.usage.input_tokens ?? 0,
          output: chunk.usage.output_tokens ?? 0,
          request: 1,
          input_cache_reads: chunk.usage.cache_read_input_tokens ?? 0,
          input_cache_writes: chunk.usage.cache_creation_input_tokens ?? 0,
        };
      }
      yield chunk;
    }
  }
}
