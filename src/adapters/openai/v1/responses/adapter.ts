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
import type { LMRouterConfigProvider } from "../../../../utils/config.js";
import type { ResponsesStore } from "../../../../utils/responses-store.js";

export type OpenAIResponsesInputOptions = {
  responsesStore: ResponsesStore;
  maxTokens?: number;
};

export abstract class OpenAIResponsesAdapter extends LMRouterAdapter<
  ResponseCreateParamsBase,
  OpenAIResponsesInputOptions,
  Response,
  ResponseStreamEvent
> {
  response?: Response;
}

const adapters: Record<string, new () => OpenAIResponsesAdapter> = {
  fireworks: OpenAIResponsesOpenAIAdapter,
  openai: OpenAIResponsesOpenAIAdapter,
  others: OpenAIResponsesOthersAdapter,
};

export class OpenAIResponsesAdapterFactory {
  static getAdapter(provider: LMRouterConfigProvider): OpenAIResponsesAdapter {
    if (
      !Object.keys(adapters).includes(provider.type) ||
      provider.responses === false
    ) {
      return new adapters.others();
    }
    return new adapters[provider.type]();
  }
}
