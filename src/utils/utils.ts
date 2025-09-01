// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import type { Context } from "hono";
import { getRuntimeKey } from "hono/adapter";
import { getConnInfo as getConnInfoWorker } from "hono/cloudflare-workers";
import { getConnInfo as getConnInfoNode } from "@hono/node-server/conninfo";

import { recordApiCall } from "./billing.js";
import { TimeKeeper } from "./chrono.js";
import { getConfig } from "./config.js";
import type {
  LMRouterConfigModel,
  LMRouterConfigModelProvider,
  LMRouterConfigProvider,
} from "../types/config.js";
import type { ContextEnv } from "../types/hono.js";

export const getUptime = (): string | undefined => {
  if (getRuntimeKey() === "workerd") {
    return;
  }

  const seconds = Math.floor(process.uptime());
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const uptime = `${days} days, ${hours % 24} hours, ${minutes % 60} minutes, ${seconds % 60} seconds`;
  return uptime;
};

export const getRemoteIp = (c: Context<ContextEnv>): string | undefined => {
  switch (getRuntimeKey()) {
    case "node":
      return getConnInfoNode(c).remote.address;
    case "workerd":
      return getConnInfoWorker(c).remote.address;
    default:
      return;
  }
};

export const getModel = (
  modelName: string,
  c: Context<ContextEnv>,
): LMRouterConfigModel | null => {
  const cfg = getConfig(c);

  if (c.var.auth?.type === "access-key" || c.var.auth?.type === "byok") {
    const colonIndex = modelName.indexOf(":");
    if (colonIndex !== -1) {
      const providerName = modelName.slice(0, colonIndex);
      const provider = cfg.providers[providerName];
      if (provider) {
        return {
          providers: [
            {
              provider: providerName,
              model: modelName.slice(colonIndex + 1),
            },
          ],
        };
      }
    }
  }

  const model = cfg.models[modelName];
  if (model) {
    return model;
  }

  if (c.var.auth?.type === "access-key" || c.var.auth?.type === "byok") {
    if (cfg.models["*"]) {
      return {
        providers: cfg.models["*"].providers.map((provider) => ({
          provider: provider.provider,
          model: modelName,
        })),
      };
    }
  }

  return null;
};

export const iterateModelProviders = async (
  c: Context<ContextEnv>,
  cb: (
    providerCfg: LMRouterConfigModelProvider,
    provider: LMRouterConfigProvider,
  ) => Promise<any>,
): Promise<any> => {
  const cfg = getConfig(c);
  let error: any = null;

  if (!c.var.model) {
    return c.json(
      {
        error: {
          message: "Model is not set",
        },
      },
      500,
    );
  }

  for (const providerCfg of c.var.model.providers) {
    const provider = cfg.providers[providerCfg.provider];
    if (!provider) {
      continue;
    }

    const hydratedProvider = { ...provider };
    hydratedProvider.api_key =
      c.var.auth?.type === "byok" ? c.var.auth.byok : provider.api_key;

    const timeKeeper = new TimeKeeper();
    try {
      timeKeeper.record();
      return await cb(providerCfg, hydratedProvider);
    } catch (e) {
      timeKeeper.record();
      await recordApiCall(
        c,
        providerCfg.provider,
        (e as any).status ?? 500,
        timeKeeper.timestamps(),
        undefined,
        providerCfg.pricing,
        (e as any).error?.error?.message ??
          (e as any).error?.message ??
          (e as any).message,
      );
      error = e;
      if (cfg.server.logging === "dev") {
        console.error(e);
      }
    }
  }

  if (error) {
    return c.json(
      {
        error: error.error?.error ??
          error.error ?? {
            message: error.message,
          },
      },
      error.status || 500,
    );
  }

  return c.json(
    {
      error: {
        message: "All providers failed to complete the request",
      },
    },
    500,
  );
};
