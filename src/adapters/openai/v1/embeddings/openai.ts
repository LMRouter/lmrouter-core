// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { HTTPException } from "hono/http-exception";
import OpenAI from "openai";
import type {
  CreateEmbeddingResponse,
  EmbeddingCreateParams,
} from "openai/resources/embeddings";

import type { OpenAIEmbeddingsAdapter } from "./adapter.js";
import type {
  LMRouterConfigModelProviderPricing,
  LMRouterConfigProvider,
} from "../../../../utils/config.js";

export class OpenAIEmbeddingsOpenAIAdapter implements OpenAIEmbeddingsAdapter {
  usage?: LMRouterConfigModelProviderPricing;

  async sendRequest(
    provider: LMRouterConfigProvider,
    request: EmbeddingCreateParams,
    options?: {},
  ): Promise<CreateEmbeddingResponse> {
    const openai = new OpenAI({
      baseURL: provider.base_url,
      apiKey: provider.api_key,
      defaultHeaders: {
        "HTTP-Referer": "https://lmrouter.com/",
        "X-Title": "LMRouter",
      },
    });
    const embeddings = await openai.embeddings.create(request);
    this.usage = {
      input: embeddings.usage.prompt_tokens,
      request: 1,
    };
    return embeddings;
  }

  async *sendRequestStreaming(
    provider: LMRouterConfigProvider,
    request: EmbeddingCreateParams,
    options?: {},
  ): AsyncGenerator<never> {
    throw new HTTPException(400, {
      message: "Embeddings API does not support streaming",
    });
  }
}
