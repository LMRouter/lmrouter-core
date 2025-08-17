// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import type {
  ImageEditStreamEvent,
  ImageEditParamsBase,
  ImagesResponse,
} from "openai/resources/images";

import type { OpenAIImageEditAdapter } from "./adapter.js";
import type { LMRouterCoreConfigProvider } from "../../../../../utils/config.js";
import type {
  FireworksImageGenerationFlux1KontextRequest,
  FireworksImageGenerationFlux1KontextResponse,
  FireworksImageGenerationGetFlux1KontextImageRequest,
  FireworksImageGenerationGetFlux1KontextImageResponse,
} from "../../../../../types/fireworks.js";

export class OpenAIImageEditFireworksAdapter implements OpenAIImageEditAdapter {
  async sendRequest(
    provider: LMRouterCoreConfigProvider,
    request: ImageEditParamsBase,
    options?: {},
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
        body: JSON.stringify(await this.convertRequest(request)),
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
        return this.convertResponse(getResultResponse);
      }

      throw new Error(`Failed to get result: ${getResultResponse.status}`);
    }
  }

  async *sendRequestStreaming(
    provider: LMRouterCoreConfigProvider,
    request: ImageEditParamsBase,
    options?: {},
  ): AsyncGenerator<ImageEditStreamEvent> {
    throw new Error("Fireworks does not support streaming");
  }

  async convertRequest(
    request: ImageEditParamsBase,
  ): Promise<FireworksImageGenerationFlux1KontextRequest> {
    const imageFile = (
      Array.isArray(request.image) ? request.image[0] : request.image
    ) as File;

    return {
      prompt: request.prompt,
      input_image: `data:${imageFile.type};base64,${Buffer.from(
        await imageFile.arrayBuffer(),
      ).toString("base64")}`,
      seed: request.seed,
      aspect_ratio: request.aspect_ratio as string | undefined,
      prompt_upsampling: request.prompt_upsampling,
      safety_tolerance: request.safety_tolerance,
    };
  }

  convertResponse(
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
