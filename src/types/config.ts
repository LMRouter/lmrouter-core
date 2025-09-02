// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import type { RulesLogic } from "json-logic-js";

export interface LMRouterConfigServer {
  host: string;
  port: number;
  logging: string;
}

export interface LMRouterConfigAuthDisabled {
  enabled: false;
}

export interface LMRouterConfigAuthEnabledBilling {
  stripe: {
    secret_key: string;
    webhook_secret: string;
    lmrouter_credits_product_id: string;
    lmrouter_fees_product_id: string;
  };
  credit_minimum: number;
  fee_rate: number;
  fee_minimum: number;
}

export interface LMRouterConfigAuthEnabled {
  enabled: true;
  database_url: string;
  better_auth: {
    secret: string;
    url: string;
    telemetry?: boolean;
    trusted_origins?: string[];
    social_providers?: Record<string, any>;
  };
  billing: LMRouterConfigAuthEnabledBilling;
}

export type LMRouterConfigAuth =
  | LMRouterConfigAuthDisabled
  | LMRouterConfigAuthEnabled;

export interface LMRouterConfigResponsesStoreInMemory {
  type: "in_memory";
}

export interface LMRouterConfigResponsesStoreUpstashRedis {
  type: "upstash_redis";
  url: string;
  token: string;
}

export type LMRouterConfigResponsesStore =
  | LMRouterConfigResponsesStoreInMemory
  | LMRouterConfigResponsesStoreUpstashRedis;

export type LMRouterConfigProviderType =
  | "openai"
  | "anthropic"
  | "fireworks"
  | "google";

export interface LMRouterConfigProvider {
  name?: string;
  type: LMRouterConfigProviderType;
  icon?: string;
  responses?: boolean;
  base_url?: string;
  api_key: string;
}

export interface LMRouterConfigModelProviderPricingFixed {
  type: "fixed";
  input?: number;
  input_image?: number;
  input_audio?: number;
  input_audio_time?: number;
  output?: number;
  output_audio?: number;
  image?: number;
  web_search?: number;
  code_interpreter?: number;
  request?: number;
  input_cache_reads?: number;
  input_cache_writes?: number;
}

export interface LMRouterConfigModelProviderPricingTiered {
  type: "tiered";
  tiers: {
    predicate?: RulesLogic;
    pricing: LMRouterConfigModelProviderPricing;
  }[];
}

export type LMRouterConfigModelProviderPricing =
  | LMRouterConfigModelProviderPricingFixed
  | LMRouterConfigModelProviderPricingTiered;

export interface LMRouterConfigModelProvider {
  provider: string;
  model: string;
  context_window?: number;
  max_tokens?: number;
  responses_only?: boolean;
  pricing?: LMRouterConfigModelProviderPricing;
}

export type LMRouterConfigModelType =
  | "language"
  | "image"
  | "embedding"
  | "audio";

export interface LMRouterConfigModel {
  name?: string;
  type?: LMRouterConfigModelType;
  icon?: string;
  author?: string;
  description?: string;
  created?: number;
  providers: LMRouterConfigModelProvider[];
}

export interface LMRouterConfig {
  server: LMRouterConfigServer;
  auth: LMRouterConfigAuth;
  responses_store: LMRouterConfigResponsesStore;
  access_keys: string[];
  providers: Record<string, LMRouterConfigProvider>;
  models: Record<string, LMRouterConfigModel>;
}
