// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type {
  ImageEditStreamEvent,
  ImageEditParamsBase,
  ImagesResponse,
} from "openai/resources/images";

import type { OpenAIImageEditAdapter } from "./adapter.js";
import type {
  FireworksImageGenerationFlux1KontextRequest,
  FireworksImageGenerationFlux1KontextResponse,
  FireworksImageGenerationGetFlux1KontextImageRequest,
  FireworksImageGenerationGetFlux1KontextImageResponse,
} from "../../../../../types/fireworks.js";
import type {
  LMRouterConfigModelProviderPricing,
  LMRouterConfigProvider,
} from "../../../../../utils/config.js";

export class OpenAIImageEditFireworksAdapter implements OpenAIImageEditAdapter {
  usage?: LMRouterConfigModelProviderPricing;

  async sendRequest(
    provider: LMRouterConfigProvider,
    request: ImageEditParamsBase,
    options?: {},
  ): Promise<ImagesResponse> {
    if (request.output_format && request.output_format !== "png") {
      throw new HTTPException(400, {
        message: "Only PNG is supported",
      });
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
      throw new HTTPException(response.status as ContentfulStatusCode, {
        message: `Failed to generate image: ${response.statusText}`,
      });
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
        throw new HTTPException(response2.status as ContentfulStatusCode, {
          message: `Failed to get result: ${response2.statusText}`,
        });
      }

      const getResultResponse =
        (await response2.json()) as FireworksImageGenerationGetFlux1KontextImageResponse;

      if (getResultResponse.status === "Pending") {
        continue;
      }

      if (getResultResponse.status === "Ready") {
        this.usage = {
          image: 1,
          request: 1,
        };
        return this.convertResponse(getResultResponse);
      }

      throw new HTTPException(500, {
        message: `Failed to get result: ${getResultResponse.status}`,
      });
    }
  }

  async *sendRequestStreaming(
    provider: LMRouterConfigProvider,
    request: ImageEditParamsBase,
    options?: {},
  ): AsyncGenerator<ImageEditStreamEvent> {
    throw new HTTPException(400, {
      message: "Fireworks does not support streaming",
    });
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
      prompt_upsampling: request.enhance_prompt,
      safety_tolerance: request.safety_tolerance,
    };
  }

  convertResponse(
    response: FireworksImageGenerationGetFlux1KontextImageResponse,
  ): ImagesResponse {
    if (response.status !== "Ready") {
      throw new HTTPException(500, {
        message: `Failed to get result: ${response.status}`,
      });
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
