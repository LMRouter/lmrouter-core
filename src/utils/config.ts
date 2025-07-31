import fs from "fs";

import yaml from "yaml";

interface LMRouterCoreConfigServer {
  host: string;
  port: number;
  logging: string;
}

type LMRouterCoreConfigProviderType = "openai" | "anthropic";

interface LMRouterCoreConfigProvider {
  type: LMRouterCoreConfigProviderType;
  base_url?: string;
  api_key: string;
}

interface LMRouterCoreConfigModelProvider {
  provider: string;
  model: string;
}

interface LMRouterCoreConfigModel {
  max_tokens?: number;
  providers: LMRouterCoreConfigModelProvider[];
}

interface LMRouterCoreConfig {
  server: LMRouterCoreConfigServer;
  access_keys: string[];
  providers: Record<string, LMRouterCoreConfigProvider>;
  models: Record<string, LMRouterCoreConfigModel>;
}

let configCache: LMRouterCoreConfig | null = null;

export const getConfig = (): LMRouterCoreConfig => {
  if (configCache) {
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
