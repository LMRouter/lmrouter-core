// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import type {
  ImageGenStreamEvent,
  ImageGenerateParamsBase,
  ImagesResponse,
} from "openai/resources/images";

import type { OpenAIImageGenerationAdapter } from "./adapter.js";
import type { LMRouterCoreConfigProvider } from "../../../../../utils/config.js";
import type {
  FireworksImageGenerationFlux1KontextRequest,
  FireworksImageGenerationFlux1KontextResponse,
  FireworksImageGenerationFlux1SchnellFp8Request,
  FireworksImageGenerationFlux1SchnellFp8RequestAspectRatio,
  FireworksImageGenerationGetFlux1KontextImageRequest,
  FireworksImageGenerationGetFlux1KontextImageResponse,
} from "../../../../../types/fireworks.js";

export class OpenAIImageGenerationFireworksAdapter
  implements OpenAIImageGenerationAdapter
{
  async sendRequest(
    provider: LMRouterCoreConfigProvider,
    request: ImageGenerateParamsBase,
    options?: {},
  ): Promise<ImagesResponse> {
    if (request.model === "accounts/fireworks/models/flux-1-schnell-fp8") {
      return this.sendRequestFlux1SchnellFp8(provider, request);
    }
    return this.sendRequestFlux1Kontext(provider, request);
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
      `${provider.base_url}/workflows/${request.model}/text_to_image`,
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

  async sendRequestFlux1Kontext(
    provider: LMRouterCoreConfigProvider,
    request: ImageGenerateParamsBase,
  ): Promise<ImagesResponse> {
    if (request.output_format && request.output_format !== "png") {
      throw new Error("Only PNG is supported");
    }

    const response = await fetch(
      `${provider.base_url}/workflows/${request.model}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.api_key}`,
        },
        body: JSON.stringify(this.convertRequestFlux1Kontext(request)),
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to generate image: ${response.statusText}`);
    }

    const requestId = (
      (await response.json()) as FireworksImageGenerationFlux1KontextResponse
    ).request_id;
    const getResultRequest: FireworksImageGenerationGetFlux1KontextImageRequest =
      {
        id: requestId,
      };

    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const response2 = await fetch(
        `${provider.base_url}/workflows/${request.model}/get_result`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${provider.api_key}`,
          },
          body: JSON.stringify(getResultRequest),
        },
      );

      if (!response2.ok) {
        throw new Error(`Failed to get result: ${response2.statusText}`);
      }

      const getResultResponse =
        (await response2.json()) as FireworksImageGenerationGetFlux1KontextImageResponse;

      if (getResultResponse.status === "Pending") {
        continue;
      }

      if (getResultResponse.status === "Ready") {
        return this.convertResponseFlux1Kontext(getResultResponse);
      }

      throw new Error(`Failed to get result: ${getResultResponse.status}`);
    }
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

  convertRequestFlux1Kontext(
    request: ImageGenerateParamsBase,
  ): FireworksImageGenerationFlux1KontextRequest {
    return {
      prompt: request.prompt,
      seed: request.seed,
      aspect_ratio: request.aspect_ratio as string | undefined,
      prompt_upsampling: request.prompt_upsampling,
      safety_tolerance: request.safety_tolerance,
    };
  }

  convertResponseFlux1Kontext(
    response: FireworksImageGenerationGetFlux1KontextImageResponse,
  ): ImagesResponse {
    if (response.status !== "Ready") {
      throw new Error(`Failed to get result: ${response.status}`);
    }

    return {
      created: Math.floor(response.result.end_time),
      data: [
        {
          revised_prompt: response.result.prompt,
          url: response.result.sample,
        },
      ],
      output_format: "png" as const,
      seed: response.result.seed,
    };
  }
}
