// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type {
  ImageGenStreamEvent,
  ImageGenerateParamsBase,
  ImagesResponse,
} from "openai/resources/images";

import type { OpenAIImageGenerationAdapter } from "./adapter.js";
import type {
  FireworksImageGenerationFlux1KontextRequest,
  FireworksImageGenerationFlux1KontextResponse,
  FireworksImageGenerationFlux1SchnellFp8Request,
  FireworksImageGenerationFlux1SchnellFp8RequestAspectRatio,
  FireworksImageGenerationGetFlux1KontextImageRequest,
  FireworksImageGenerationGetFlux1KontextImageResponse,
} from "../../../../../types/fireworks.js";
import type {
  LMRouterConfigModelProviderPricing,
  LMRouterConfigProvider,
} from "../../../../../utils/config.js";

export class OpenAIImageGenerationFireworksAdapter
  implements OpenAIImageGenerationAdapter
{
  usage?: LMRouterConfigModelProviderPricing;

  async sendRequest(
    provider: LMRouterConfigProvider,
    request: ImageGenerateParamsBase,
    options?: {},
  ): Promise<ImagesResponse> {
    if (request.model === "accounts/fireworks/models/flux-1-schnell-fp8") {
      return this.sendRequestFlux1SchnellFp8(provider, request);
    }
    return this.sendRequestFlux1Kontext(provider, request);
  }

  async *sendRequestStreaming(
    provider: LMRouterConfigProvider,
    request: ImageGenerateParamsBase,
    options?: {},
  ): AsyncGenerator<ImageGenStreamEvent> {
    throw new HTTPException(400, {
      message: "Fireworks does not support streaming",
    });
  }

  async sendRequestFlux1SchnellFp8(
    provider: LMRouterConfigProvider,
    request: ImageGenerateParamsBase,
  ): Promise<ImagesResponse> {
    if (request.output_format && request.output_format !== "jpeg") {
      throw new HTTPException(400, {
        message: "Only JPEG is supported",
      });
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
      throw new HTTPException(response.status as ContentfulStatusCode, {
        message: `Failed to generate image: ${response.statusText}`,
      });
    }

    this.usage = {
      request: request.num_inference_steps,
    };
    return await this.convertResponseFlux1SchnellFp8(response);
  }

  async sendRequestFlux1Kontext(
    provider: LMRouterConfigProvider,
    request: ImageGenerateParamsBase,
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
        body: JSON.stringify(this.convertRequestFlux1Kontext(request)),
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
        return this.convertResponseFlux1Kontext(getResultResponse);
      }

      throw new HTTPException(500, {
        message: `Failed to get result: ${getResultResponse.status}`,
      });
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
      prompt_upsampling: request.enhance_prompt,
      safety_tolerance: request.safety_tolerance,
    };
  }

  convertResponseFlux1Kontext(
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
