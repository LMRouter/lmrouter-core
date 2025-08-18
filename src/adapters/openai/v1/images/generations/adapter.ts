// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import type {
  ImageGenStreamEvent,
  ImageGenerateParamsBase,
  ImagesResponse,
} from "openai/resources/images";

import { LMRouterAdapter } from "../../../../adapter.js";
import { OpenAIImageGenerationFireworksAdapter } from "./fireworks.js";
import { OpenAIImageGenerationGoogleAdapter } from "./google.js";
import { OpenAIImageGenerationOpenAIAdapter } from "./openai.js";
import type { LMRouterCoreConfigProvider } from "../../../../../utils/config.js";

export type OpenAIImageGenerationAdapter = LMRouterAdapter<
  ImageGenerateParamsBase,
  {},
  ImagesResponse,
  ImageGenStreamEvent
>;

const adapters: Record<string, new () => OpenAIImageGenerationAdapter> = {
  fireworks: OpenAIImageGenerationFireworksAdapter,
  google: OpenAIImageGenerationGoogleAdapter,
  others: OpenAIImageGenerationOpenAIAdapter,
};

export class OpenAIImageGenerationAdapterFactory {
  static getAdapter(
    provider: LMRouterCoreConfigProvider,
  ): OpenAIImageGenerationAdapter {
    if (!Object.keys(adapters).includes(provider.type)) {
      return new adapters.others();
    }
    return new adapters[provider.type]();
  }
}
