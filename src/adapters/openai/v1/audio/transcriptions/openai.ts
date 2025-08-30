// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import OpenAI from "openai";
import { Stream } from "openai/core/streaming";
import type {
  Transcription,
  TranscriptionCreateParamsBase,
  TranscriptionCreateParamsNonStreaming,
  TranscriptionCreateParamsStreaming,
  TranscriptionStreamEvent,
} from "openai/resources/audio/transcriptions";

import type { OpenAITranscriptionsAdapter } from "./adapter.js";
import type { LMRouterApiCallUsage } from "../../../../../utils/billing.js";
import type { LMRouterConfigProvider } from "../../../../../utils/config.js";

export class OpenAITranscriptionsOpenAIAdapter
  implements OpenAITranscriptionsAdapter
{
  usage?: LMRouterApiCallUsage;

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
    request: TranscriptionCreateParamsBase,
    options?: {},
  ): Promise<Transcription> {
    const openai = this.getClient(provider);
    const transcription = await openai.audio.transcriptions.create(
      request as TranscriptionCreateParamsNonStreaming,
    );
    this.usage = {
      input:
        transcription.usage?.type === "tokens"
          ? transcription.usage.input_tokens -
            (transcription.usage.input_token_details?.audio_tokens ?? 0)
          : 0,
      input_audio:
        transcription.usage?.type === "tokens"
          ? (transcription.usage.input_token_details?.audio_tokens ?? 0)
          : 0,
      input_audio_time:
        transcription.usage?.type === "duration"
          ? transcription.usage.seconds
          : 0,
      output:
        transcription.usage?.type === "tokens"
          ? transcription.usage.output_tokens
          : 0,
      request: 1,
    };
    return transcription;
  }

  async sendRequestStreaming(
    provider: LMRouterConfigProvider,
    request: TranscriptionCreateParamsBase,
    options?: {},
  ): Promise<AsyncGenerator<TranscriptionStreamEvent>> {
    const openai = this.getClient(provider);
    const transcription = await openai.audio.transcriptions.create(
      request as TranscriptionCreateParamsStreaming,
    );
    return async function* (this: OpenAITranscriptionsOpenAIAdapter) {
      for await (const chunk of transcription as Stream<TranscriptionStreamEvent>) {
        if (chunk.type === "transcript.text.done") {
          this.usage = {
            input:
              (chunk.usage?.input_tokens ?? 0) -
              (chunk.usage?.input_token_details?.audio_tokens ?? 0),
            input_audio: chunk.usage?.input_token_details?.audio_tokens ?? 0,
            output: chunk.usage?.output_tokens ?? 0,
            request: 1,
          };
        }
        yield chunk;
      }
    }.bind(this)();
  }
}
