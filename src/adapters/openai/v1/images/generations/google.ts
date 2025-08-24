// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import {
  GenerateContentResponse,
  GenerateImagesResponse,
  GoogleGenAI,
  MediaResolution,
  Modality,
  PersonGeneration,
  type GenerateContentParameters,
  type GenerateImagesParameters,
} from "@google/genai";
import { HTTPException } from "hono/http-exception";
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

export class OpenAIImageGenerationGoogleAdapter
  implements OpenAIImageGenerationAdapter
{
  usage?: LMRouterConfigModelProviderPricing;

  getClient(provider: LMRouterConfigProvider): GoogleGenAI {
    return new GoogleGenAI({
      apiKey: provider.api_key,
    });
  }

  async sendRequest(
    provider: LMRouterConfigProvider,
    request: ImageGenerateParamsBase,
    options?: {},
  ): Promise<ImagesResponse> {
    if (request.model?.startsWith("imagen")) {
      return this.sendRequestImagen(provider, request);
    }
    return this.sendRequestGemini(provider, request);
  }

  async *sendRequestStreaming(
    provider: LMRouterConfigProvider,
    request: ImageGenerateParamsBase,
    options?: {},
  ): AsyncGenerator<ImageGenStreamEvent> {
    throw new HTTPException(400, {
      message: "Google does not support streaming",
    });
  }

  async sendRequestImagen(
    provider: LMRouterConfigProvider,
    request: ImageGenerateParamsBase,
  ): Promise<ImagesResponse> {
    const ai = this.getClient(provider);
    const image = await ai.models.generateImages(
      this.convertRequestImagen(request),
    );
    this.usage = {
      image: image.generatedImages?.length ?? 0,
      request: 1,
    };
    return this.convertResponseImagen(image);
  }

  async sendRequestGemini(
    provider: LMRouterConfigProvider,
    request: ImageGenerateParamsBase,
  ): Promise<ImagesResponse> {
    const ai = this.getClient(provider);
    const image = await ai.models.generateContent(
      this.convertRequestGemini(request),
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
    return this.convertResponseGemini(image);
  }

  convertRequestImagen(
    request: ImageGenerateParamsBase,
  ): GenerateImagesParameters {
    return {
      model: request.model ?? "",
      prompt: request.prompt,
      config: {
        negativePrompt: request.negative_prompt,
        numberOfImages: request.n ?? undefined,
        aspectRatio: request.aspect_ratio,
        guidanceScale: request.guidance_scale,
        seed: request.seed,
        personGeneration: PersonGeneration.ALLOW_ALL,
        imageSize:
          request.quality === "hd" || request.quality === "high"
            ? "2K"
            : request.quality === "low" || request.quality === "medium"
              ? "1K"
              : undefined,
        enhancePrompt: request.enhance_prompt,
      },
    };
  }

  convertResponseImagen(response: GenerateImagesResponse): ImagesResponse {
    return {
      created: 0,
      data: response.generatedImages?.map((image) => ({
        b64_json: image.image?.imageBytes,
        revised_prompt: image.enhancedPrompt,
        url: image.image?.gcsUri,
      })),
      output_format: "png" as const,
    };
  }

  convertRequestGemini(
    request: ImageGenerateParamsBase,
  ): GenerateContentParameters {
    return {
      model: request.model ?? "",
      contents: request.prompt,
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

  convertResponseGemini(response: GenerateContentResponse): ImagesResponse {
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
