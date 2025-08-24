// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import OpenAI from "openai";
import { Stream } from "openai/core/streaming";
import type {
  ImageEditParamsBase,
  ImageEditStreamEvent,
  ImagesResponse,
} from "openai/resources/images";

import type { OpenAIImageEditAdapter } from "./adapter.js";
import type {
  LMRouterConfigModelProviderPricing,
  LMRouterConfigProvider,
} from "../../../../../utils/config.js";

export class OpenAIImageEditOpenAIAdapter implements OpenAIImageEditAdapter {
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
    request: ImageEditParamsBase,
    options?: {},
  ): Promise<ImagesResponse> {
    const openai = this.getClient(provider);
    const image = await openai.images.edit(request);
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
    request: ImageEditParamsBase,
    options?: {},
  ): AsyncGenerator<ImageEditStreamEvent> {
    const openai = this.getClient(provider);
    const stream = await openai.images.edit(request);
    for await (const chunk of stream as Stream<ImageEditStreamEvent>) {
      if (chunk.type === "image_edit.completed") {
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
