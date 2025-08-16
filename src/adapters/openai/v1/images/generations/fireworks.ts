// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import type {
  ImageGenStreamEvent,
  ImageGenerateParamsBase,
  ImagesResponse,
} from "openai/resources/images";

import type { OpenAIImageGenerationAdapter } from "./adapter.js";
import type { LMRouterCoreConfigProvider } from "../../../../../utils/config.js";

type FireworksImageGenerationFlux1SchnellFp8RequestAspectRatio =
  | "1:1"
  | "21:9"
  | "16:9"
  | "3:2"
  | "5:4"
  | "4:5"
  | "2:3"
  | "9:16"
  | "9:21"
  | "4:3"
  | "3:4";

interface FireworksImageGenerationFlux1SchnellFp8Request {
  prompt: string;
  aspect_ratio?: FireworksImageGenerationFlux1SchnellFp8RequestAspectRatio;
  guidance_scale?: number;
  num_inference_steps?: number;
  seed?: number;
}

export class OpenAIImageGenerationFireworksAdapter
  implements OpenAIImageGenerationAdapter
{
  async sendRequest(
    provider: LMRouterCoreConfigProvider,
    request: ImageGenerateParamsBase,
    options?: {},
  ): Promise<ImagesResponse> {
    if (request.model === "flux-1-schnell-fp8") {
      return this.sendRequestFlux1SchnellFp8(provider, request);
    }
    throw new Error(`Unsupported model: ${request.model}`);
  }

  async *sendRequestStreaming(
    provider: LMRouterCoreConfigProvider,
    request: ImageGenerateParamsBase,
    options?: {},
  ): AsyncGenerator<ImageGenStreamEvent> {
    throw new Error("Fireworks does not support streaming");
  }

  async sendRequestFlux1SchnellFp8(
    provider: LMRouterCoreConfigProvider,
    request: ImageGenerateParamsBase,
  ): Promise<ImagesResponse> {
    if (request.output_format && request.output_format !== "jpeg") {
      throw new Error("Only JPEG is supported");
    }

    const response = await fetch(
      `${provider.base_url}/workflows/accounts/fireworks/models/${request.model}/text_to_image`,
      {
        method: "POST",
        headers: {
          Accept: "image/jpeg",
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.api_key}`,
        },
        body: JSON.stringify(this.convertRequestFlux1SchnellFp8(request)),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to generate image: ${response.statusText}`);
    }

    return await this.convertResponseFlux1SchnellFp8(response);
  }

  convertRequestFlux1SchnellFp8(
    request: ImageGenerateParamsBase,
  ): FireworksImageGenerationFlux1SchnellFp8Request {
    return {
      prompt: request.prompt,
      aspect_ratio: request.aspect_ratio as
        | FireworksImageGenerationFlux1SchnellFp8RequestAspectRatio
        | undefined,
      guidance_scale: request.guidance_scale,
      num_inference_steps: request.num_inference_steps,
      seed: request.seed,
    };
  }

  async convertResponseFlux1SchnellFp8(
    response: Response,
  ): Promise<ImagesResponse> {
    const seed = response.headers.get("Seed");
    return {
      created: 0,
      data: [
        {
          b64_json: Buffer.from(await response.arrayBuffer()).toString(
            "base64",
          ),
        },
      ],
      output_format: "jpeg" as const,
      seed: seed ? parseInt(seed) : undefined,
    };
  }
}
