// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import type { SpeechCreateParams } from "openai/resources/audio/speech";

import { LMRouterAdapter } from "../../../../adapter.js";
import { OpenAISpeechOpenAIAdapter } from "./openai.js";
import type { LMRouterConfigProvider } from "../../../../../types/config.js";

export type OpenAISpeechAdapter = LMRouterAdapter<
  SpeechCreateParams,
  {},
  Response,
  never
>;

const adapters: Record<string, new () => OpenAISpeechAdapter> = {
  others: OpenAISpeechOpenAIAdapter,
};

export class OpenAISpeechAdapterFactory {
  static getAdapter(provider: LMRouterConfigProvider): OpenAISpeechAdapter {
    if (!Object.keys(adapters).includes(provider.type)) {
      return new adapters.others();
    }
    return new adapters[provider.type]();
  }
}
