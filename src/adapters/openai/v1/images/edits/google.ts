// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import {
  GenerateContentResponse,
  GoogleGenAI,
  MediaResolution,
  Modality,
  type GenerateContentParameters,
} from "@google/genai";
import { HTTPException } from "hono/http-exception";
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

export class OpenAIImageEditGoogleAdapter implements OpenAIImageEditAdapter {
  usage?: LMRouterConfigModelProviderPricing;

  async sendRequest(
    provider: LMRouterConfigProvider,
    request: ImageEditParamsBase,
    options?: {},
  ): Promise<ImagesResponse> {
    const ai = new GoogleGenAI({
      apiKey: provider.api_key,
    });
    const image = await ai.models.generateContent(
      await this.convertRequest(request),
    );
    this.usage = {
      input: image.usageMetadata?.promptTokenCount ?? 0,
      output: image.usageMetadata?.candidatesTokenCount ?? 0,
      image:
        image.candidates?.filter(
          (candidate) =>
            candidate.content?.parts?.find(
              (part) => part.inlineData !== undefined,
            ) !== undefined,
        ).length ?? 0,
      request: 1,
    };
    return this.convertResponse(image);
  }

  async *sendRequestStreaming(
    provider: LMRouterConfigProvider,
    request: ImageEditParamsBase,
    options?: {},
  ): AsyncGenerator<ImageEditStreamEvent> {
    throw new HTTPException(400, {
      message: "Google does not support streaming",
    });
  }

  async convertRequest(
    request: ImageEditParamsBase,
  ): Promise<GenerateContentParameters> {
    const images = (
      Array.isArray(request.image) ? request.image : [request.image]
    ) as File[];
    const imageParts = [];
    for (const image of images) {
      imageParts.push({
        inlineData: {
          mimeType: image.type,
          data: Buffer.from(await image.arrayBuffer()).toString("base64"),
        },
      });
    }

    return {
      model: request.model ?? "",
      contents: [{ text: request.prompt }, ...imageParts],
      config: {
        candidateCount: request.n ?? undefined,
        seed: request.seed,
        responseModalities: [Modality.TEXT, Modality.IMAGE],
        mediaResolution:
          request.quality === "high"
            ? MediaResolution.MEDIA_RESOLUTION_HIGH
            : request.quality === "low"
              ? MediaResolution.MEDIA_RESOLUTION_LOW
              : request.quality === "medium"
                ? MediaResolution.MEDIA_RESOLUTION_MEDIUM
                : undefined,
      },
    };
  }

  convertResponse(response: GenerateContentResponse): ImagesResponse {
    return {
      created: 0,
      data: response.candidates
        ?.map((candidate) => {
          const imagePart = candidate.content?.parts?.find(
            (part) => part.inlineData !== undefined,
          );
          if (!imagePart) {
            return;
          }
          return {
            b64_json: imagePart.inlineData!.data,
          };
        })
        .filter((image) => image !== undefined),
      output_format: "png" as const,
      usage: {
        input_tokens: response.usageMetadata?.promptTokenCount ?? 0,
        input_tokens_details: {
          image_tokens: 0,
          text_tokens: 0,
        },
        output_tokens: response.usageMetadata?.candidatesTokenCount ?? 0,
        total_tokens: response.usageMetadata?.totalTokenCount ?? 0,
      },
    };
  }
}
