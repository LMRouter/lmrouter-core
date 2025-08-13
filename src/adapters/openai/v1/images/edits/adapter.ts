// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import type {
  ImageEditParamsBase,
  ImageEditStreamEvent,
  ImagesResponse,
} from "openai/resources/images";

import { LMRouterAdapter } from "../../../../adapter.js";
import { OpenAIImageEditOpenAIAdapter } from "./openai.js";
import type { LMRouterCoreConfigProvider } from "../../../../../utils/config.js";

export type OpenAIImageEditAdapter = LMRouterAdapter<
  ImageEditParamsBase,
  {},
  ImagesResponse,
  ImageEditStreamEvent
>;

const adapters: Record<string, new () => OpenAIImageEditAdapter> = {
  openai: OpenAIImageEditOpenAIAdapter,
  openai_woresp: OpenAIImageEditOpenAIAdapter,
};

export class OpenAIImageEditAdapterFactory {
  static getAdapter(
    provider: LMRouterCoreConfigProvider,
  ): OpenAIImageEditAdapter {
    if (!Object.keys(adapters).includes(provider.type)) {
      throw new Error(`Unsupported provider: ${provider.type}`);
    }
    return new adapters[provider.type]();
  }
}
