// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import type {
  LMRouterConfigModelProviderPricing,
  LMRouterConfigProvider,
} from "../utils/config.js";

export abstract class LMRouterAdapter<
  TInput,
  TInputOptions,
  TOutput,
  TOutputStreamChunk,
> {
  usage?: LMRouterConfigModelProviderPricing;

  abstract sendRequest(
    provider: LMRouterConfigProvider,
    request: TInput,
    options?: TInputOptions,
  ): Promise<TOutput>;

  abstract sendRequestStreaming(
    provider: LMRouterConfigProvider,
    request: TInput,
    options?: TInputOptions,
  ): AsyncGenerator<TOutputStreamChunk>;
}
