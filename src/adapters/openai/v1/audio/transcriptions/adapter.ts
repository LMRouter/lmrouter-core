// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import type {
  Transcription,
  TranscriptionCreateParamsBase,
  TranscriptionStreamEvent,
} from "openai/resources/audio/transcriptions";

import { LMRouterAdapter } from "../../../../adapter.js";
import { OpenAITranscriptionsOpenAIAdapter } from "./openai.js";
import type { LMRouterConfigProvider } from "../../../../../utils/config.js";

export type OpenAITranscriptionsAdapter = LMRouterAdapter<
  TranscriptionCreateParamsBase,
  {},
  Transcription,
  TranscriptionStreamEvent
>;

const adapters: Record<string, new () => OpenAITranscriptionsAdapter> = {
  others: OpenAITranscriptionsOpenAIAdapter,
};

export class OpenAITranscriptionsAdapterFactory {
  static getAdapter(
    provider: LMRouterConfigProvider,
  ): OpenAITranscriptionsAdapter {
    if (!Object.keys(adapters).includes(provider.type)) {
      return new adapters.others();
    }
    return new adapters[provider.type]();
  }
}
