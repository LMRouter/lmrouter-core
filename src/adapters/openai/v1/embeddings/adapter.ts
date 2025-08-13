// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import type {
  CreateEmbeddingResponse,
  EmbeddingCreateParams,
} from "openai/resources/embeddings";

import { LMRouterAdapter } from "../../../adapter.js";
import { OpenAIEmbeddingsOpenAIAdapter } from "./openai.js";
import type { LMRouterCoreConfigProvider } from "../../../../utils/config.js";

export type OpenAIEmbeddingsAdapter = LMRouterAdapter<
  EmbeddingCreateParams,
  {},
  CreateEmbeddingResponse,
  never
>;

const adapters: Record<string, new () => OpenAIEmbeddingsAdapter> = {
  openai: OpenAIEmbeddingsOpenAIAdapter,
  openai_woresp: OpenAIEmbeddingsOpenAIAdapter,
};

export class OpenAIEmbeddingsAdapterFactory {
  static getAdapter(
    provider: LMRouterCoreConfigProvider,
  ): OpenAIEmbeddingsAdapter {
    if (!Object.keys(adapters).includes(provider.type)) {
      throw new Error(`Unsupported provider: ${provider.type}`);
    }
    return new adapters[provider.type]();
  }
}
