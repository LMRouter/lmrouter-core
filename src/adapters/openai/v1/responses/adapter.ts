// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import type {
  Response,
  ResponseCreateParamsBase,
  ResponseStreamEvent,
} from "openai/resources/responses/responses";

import { LMRouterAdapter } from "../../../adapter.js";
import { OpenAIResponsesOpenAIAdapter } from "./openai.js";
import { OpenAIResponsesOthersAdapter } from "./others.js";
import type { LMRouterCoreConfigProvider } from "../../../../utils/config.js";

export type OpenAIResponsesInputOptions = {
  maxTokens?: number;
};

export abstract class OpenAIResponsesAdapter extends LMRouterAdapter<
  ResponseCreateParamsBase,
  OpenAIResponsesInputOptions,
  Response,
  ResponseStreamEvent
> {
  response: Response | undefined;
}

const adapters: Record<string, new () => OpenAIResponsesAdapter> = {
  fireworks: OpenAIResponsesOpenAIAdapter,
  openai: OpenAIResponsesOpenAIAdapter,
  others: OpenAIResponsesOthersAdapter,
};

export class OpenAIResponsesAdapterFactory {
  static getAdapter(
    provider: LMRouterCoreConfigProvider,
  ): OpenAIResponsesAdapter {
    if (!Object.keys(adapters).includes(provider.type)) {
      return new adapters.others();
    }
    return new adapters[provider.type]();
  }
}
