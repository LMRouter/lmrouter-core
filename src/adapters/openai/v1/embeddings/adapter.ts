// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import type {
  CreateEmbeddingResponse,
  EmbeddingCreateParams,
} from "openai/resources/embeddings";

import { LMRouterAdapter } from "../../../adapter.js";
import { OpenAIEmbeddingsOpenAIAdapter } from "./openai.js";
import type { LMRouterConfigProvider } from "../../../../utils/config.js";

export type OpenAIEmbeddingsAdapter = LMRouterAdapter<
  EmbeddingCreateParams,
  {},
  CreateEmbeddingResponse,
  never
>;

const adapters: Record<string, new () => OpenAIEmbeddingsAdapter> = {
  others: OpenAIEmbeddingsOpenAIAdapter,
};

export class OpenAIEmbeddingsAdapterFactory {
  static getAdapter(provider: LMRouterConfigProvider): OpenAIEmbeddingsAdapter {
    if (!Object.keys(adapters).includes(provider.type)) {
      return new adapters.others();
    }
    return new adapters[provider.type]();
  }
}
