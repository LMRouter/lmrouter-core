// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import OpenAI from "openai";
import { Stream } from "openai/core/streaming";
import type {
  ImageGenStreamEvent,
  ImageGenerateParamsBase,
  ImagesResponse,
} from "openai/resources/images";

import type { OpenAIImageGenerationAdapter } from "./adapter.js";
import type {
  LMRouterConfigModelProviderPricing,
  LMRouterConfigProvider,
} from "../../../../../utils/config.js";

export class OpenAIImageGenerationOpenAIAdapter
  implements OpenAIImageGenerationAdapter
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
    request: ImageGenerateParamsBase,
    options?: {},
  ): Promise<ImagesResponse> {
    const openai = this.getClient(provider);
    const image = await openai.images.generate(request);
    this.usage = {
      input: (image as ImagesResponse).usage?.input_tokens ?? 0,
      output: (image as ImagesResponse).usage?.output_tokens ?? 0,
      image: (image as ImagesResponse).data?.length ?? 0,
      request: 1,
    };
    return image as ImagesResponse;
  }

  async *sendRequestStreaming(
    provider: LMRouterConfigProvider,
    request: ImageGenerateParamsBase,
    options?: {},
  ): AsyncGenerator<ImageGenStreamEvent> {
    const openai = this.getClient(provider);
    const stream = await openai.images.generate(request);
    for await (const chunk of stream as Stream<ImageGenStreamEvent>) {
      if (chunk.type === "image_generation.completed") {
        this.usage = {
          input: chunk.usage.input_tokens,
          output: chunk.usage.output_tokens,
          image: 1,
          request: 1,
        };
        yield chunk;
      }
    }
  }
}
