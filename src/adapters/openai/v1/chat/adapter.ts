// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsBase,
} from "openai/resources/chat/completions";

import { LMRouterAdapter } from "../../../adapter.js";
import { OpenAIChatCompletionAnthropicAdapter } from "./anthropic.js";
import { OpenAIChatCompletionOpenAIAdapter } from "./openai.js";
import type { LMRouterCoreConfigProvider } from "../../../../utils/config.js";

export type OpenAIChatCompletionInputOptions = {
  maxTokens?: number;
};

export type OpenAIChatCompletionAdapter = LMRouterAdapter<
  ChatCompletionCreateParamsBase,
  OpenAIChatCompletionInputOptions,
  ChatCompletion,
  ChatCompletionChunk
>;

const adapters: Record<string, new () => OpenAIChatCompletionAdapter> = {
  anthropic: OpenAIChatCompletionAnthropicAdapter,
  openai: OpenAIChatCompletionOpenAIAdapter,
  openai_woresp: OpenAIChatCompletionOpenAIAdapter,
};

export class OpenAIChatCompletionAdapterFactory {
  static getAdapter(
    provider: LMRouterCoreConfigProvider,
  ): OpenAIChatCompletionAdapter {
    if (!Object.keys(adapters).includes(provider.type)) {
      throw new Error(`Unsupported provider: ${provider.type}`);
    }
    return new adapters[provider.type]();
  }
}
