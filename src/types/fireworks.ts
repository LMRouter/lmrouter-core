// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

export type FireworksImageGenerationFlux1SchnellFp8RequestAspectRatio =
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

export interface FireworksImageGenerationFlux1SchnellFp8Request {
  prompt: string;
  aspect_ratio?: FireworksImageGenerationFlux1SchnellFp8RequestAspectRatio;
  guidance_scale?: number;
  num_inference_steps?: number;
  seed?: number;
}

export interface FireworksImageGenerationFlux1KontextRequest {
  prompt: string;
  input_image?: string | null;
  seed?: number | null;
  aspect_ratio?: string | null;
  webhook_url?: string | null;
  webhook_secret?: string | null;
  prompt_upsampling?: boolean;
  safety_tolerance?: number;
}

export interface FireworksImageGenerationFlux1KontextResponse {
  request_id: string;
}

export interface FireworksImageGenerationGetFlux1KontextImageRequest {
  id: string;
}

export interface FireworksImageGenerationGetFlux1KontextImageResponse {
  id: string;
  status:
    | "Task not found"
    | "Pending"
    | "Request Moderated"
    | "Content Moderated"
    | "Ready"
    | "Error";
  result: any;
  progress: number | null;
  details: object | null;
}
