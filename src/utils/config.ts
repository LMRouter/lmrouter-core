// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import fs from "fs";

import type { Context } from "hono";
import yaml from "yaml";

export interface LMRouterConfigServer {
  host: string;
  port: number;
  logging: string;
}

export type LMRouterConfigProviderType =
  | "openai"
  | "openai_woresp"
  | "anthropic"
  | "fireworks"
  | "google";

export interface LMRouterConfigProvider {
  type: LMRouterConfigProviderType;
  base_url?: string;
  api_key: string;
}

export interface LMRouterConfigModelProvider {
  provider: string;
  model: string;
}

export interface LMRouterConfigModel {
  max_tokens?: number;
  providers: LMRouterConfigModelProvider[];
}

export interface LMRouterConfig {
  server: LMRouterConfigServer;
  access_keys: string[];
  providers: Record<string, LMRouterConfigProvider>;
  models: Record<string, LMRouterConfigModel>;
}

let configCache: LMRouterConfig | null = null;

export const getConfig = (c?: Context): LMRouterConfig => {
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
