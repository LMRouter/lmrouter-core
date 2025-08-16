// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import "openai/resources/images";

declare module "openai/resources/images" {
  interface ImageGenerateParamsBase {
    negative_prompt?: string;
    aspect_ratio?: string;
    seed?: number;
    guidance_scale?: number;
    num_inference_steps?: number;
  }

  interface ImagesResponse {
    seed?: number;
  }
}
