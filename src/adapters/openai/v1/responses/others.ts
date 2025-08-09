// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsBase,
} from "openai/resources/chat/completions";
import type {
  Response,
  ResponseCreateParamsBase,
  ResponseStreamEvent,
} from "openai/resources/responses/responses";

import type {
  OpenAIResponsesAdapter,
  OpenAIResponsesInputOptions,
} from "./adapter.js";
import {
  OpenAIChatCompletionAdapterFactory,
  type OpenAIChatCompletionAdapter,
} from "../chat/adapter.js";
import type { LMRouterCoreConfigProvider } from "../../../../utils/config.js";

export class OpenAIResponsesOthersAdapter implements OpenAIResponsesAdapter {
  getAdapter(
    provider: LMRouterCoreConfigProvider,
  ): OpenAIChatCompletionAdapter {
    return OpenAIChatCompletionAdapterFactory.getAdapter(provider);
  }

  async sendRequest(
    provider: LMRouterCoreConfigProvider,
    request: ResponseCreateParamsBase,
    options?: OpenAIResponsesInputOptions,
  ): Promise<Response> {
    const adapter = this.getAdapter(provider);
    const response = await adapter.sendRequest(
      provider,
      this.convertRequest(request),
    );
    return this.convertResponse(response);
  }

  async *sendRequestStreaming(
    provider: LMRouterCoreConfigProvider,
    request: ResponseCreateParamsBase,
    options?: OpenAIResponsesInputOptions,
  ): AsyncGenerator<ResponseStreamEvent> {
    const adapter = this.getAdapter(provider);
    const stream = adapter.sendRequestStreaming(
      provider,
      this.convertRequest(request),
    );
    for await (const chunk of this.convertStream(stream)) {
      yield chunk;
    }
  }

  convertRequest(
    request: ResponseCreateParamsBase,
  ): ChatCompletionCreateParamsBase {
    return request as ChatCompletionCreateParamsBase;
  }

  convertResponse(response: ChatCompletion): Response {
    return response as unknown as Response;
  }

  async *convertStream(
    stream: AsyncGenerator<ChatCompletionChunk>,
  ): AsyncGenerator<ResponseStreamEvent> {
    for await (const chunk of stream) {
      yield chunk as unknown as ResponseStreamEvent;
    }
  }
}
