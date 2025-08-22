// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import fs from "fs";

import type { Context } from "hono";
import yaml from "yaml";

import type { ContextEnv } from "../types/hono.js";

export interface LMRouterConfigServer {
  host: string;
  port: number;
  logging: string;
}

export interface LMRouterConfigAuthDisabled {
  enabled: false;
}

export interface LMRouterConfigAuthEnabled {
  enabled: true;
  database_url: string;
  better_auth: {
    secret: string;
    url: string;
    telemetry?: boolean;
    trusted_origins?: string[];
  };
}

export type LMRouterConfigAuth =
  | LMRouterConfigAuthDisabled
  | LMRouterConfigAuthEnabled;

export type LMRouterConfigProviderType =
  | "openai"
  | "anthropic"
  | "fireworks"
  | "google";

export interface LMRouterConfigProvider {
  name?: string;
  type: LMRouterConfigProviderType;
  responses?: boolean | "only";
  base_url?: string;
  api_key: string;
}

export interface LMRouterConfigModelProviderPricing {
  input?: number;
  output?: number;
  image?: number;
  request?: number;
  input_cache_reads?: number;
  input_cache_writes?: number;
}

export interface LMRouterConfigModelProvider {
  provider: string;
  model: string;
  context_window?: number;
  max_tokens?: number;
  pricing?: LMRouterConfigModelProviderPricing;
}

export interface LMRouterConfigModel {
  name?: string;
  description?: string;
  created?: number;
  providers: LMRouterConfigModelProvider[];
}

export interface LMRouterConfig {
  server: LMRouterConfigServer;
  auth: LMRouterConfigAuth;
  access_keys: string[];
  providers: Record<string, LMRouterConfigProvider>;
  models: Record<string, LMRouterConfigModel>;
}

let configCache: LMRouterConfig | null = null;

export const getConfig = (c?: Context<ContextEnv>): LMRouterConfig => {
  if (configCache) {
    return configCache;
  }

  const configFromEnv = c?.env.LMROUTER_CONFIG ?? process.env.LMROUTER_CONFIG;
  if (configFromEnv) {
    console.log("Loading config from env...");
    configCache = yaml.parse(
      Buffer.from(configFromEnv, "base64").toString("utf8"),
    ) as LMRouterConfig;
    return configCache;
  }

  if (process.argv.length < 3) {
    console.log("Loading default config...");
    configCache = yaml.parse(
      fs.readFileSync(
        new URL("../../config/config.default.example.yaml", import.meta.url)
          .pathname,
        "utf8",
      ),
    ) as LMRouterConfig;
    return configCache;
  }

  console.log(`Loading config from file "${process.argv[2]}"...`);
  configCache = yaml.parse(
    fs.readFileSync(process.argv[2], "utf8"),
  ) as LMRouterConfig;
  return configCache;
};
