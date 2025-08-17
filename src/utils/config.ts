// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import fs from "fs";

import type { Context } from "hono";
import yaml from "yaml";

export interface LMRouterCoreConfigServer {
  host: string;
  port: number;
  logging: string;
}

export type LMRouterCoreConfigProviderType =
  | "openai"
  | "openai_woresp"
  | "anthropic"
  | "fireworks";

export interface LMRouterCoreConfigProvider {
  type: LMRouterCoreConfigProviderType;
  base_url?: string;
  api_key: string;
}

export interface LMRouterCoreConfigModelProvider {
  provider: string;
  model: string;
}

export interface LMRouterCoreConfigModel {
  max_tokens?: number;
  providers: LMRouterCoreConfigModelProvider[];
}

export interface LMRouterCoreConfig {
  server: LMRouterCoreConfigServer;
  access_keys: string[];
  providers: Record<string, LMRouterCoreConfigProvider>;
  models: Record<string, LMRouterCoreConfigModel>;
}

let configCache: LMRouterCoreConfig | null = null;

export const getConfig = (c?: Context): LMRouterCoreConfig => {
  if (configCache) {
    return configCache;
  }

  if (c?.env.CONFIG) {
    configCache = yaml.parse(
      Buffer.from(c.env.CONFIG, "base64").toString("utf8"),
    ) as LMRouterCoreConfig;
    return configCache;
  }

  if (process.argv.length < 3) {
    console.error(`Usage: ${process.argv[0]} ${process.argv[1]} <config-file>`);
    process.exit(1);
  }

  configCache = yaml.parse(
    fs.readFileSync(process.argv[2], "utf8"),
  ) as LMRouterCoreConfig;
  return configCache;
};
