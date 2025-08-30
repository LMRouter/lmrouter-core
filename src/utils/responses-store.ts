// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type {
  Response,
  ResponseCreateParamsBase,
  ResponseInput,
} from "openai/resources/responses/responses";

import { getConfig } from "./config.js";
import type { ContextEnv } from "../types/hono.js";

interface ResponsesStoreItem {
  request: ResponseCreateParamsBase;
  response: Response;
  fullContext: ResponseInput;
}

export abstract class ResponsesStore {
  abstract get(responseId: string): Promise<ResponsesStoreItem | null>;

  async set(
    request: ResponseCreateParamsBase,
    response: Response,
  ): Promise<void> {
    const fullContext: ResponseInput = [];
    if (request.previous_response_id) {
      const previousItem = await this.get(request.previous_response_id);
      if (previousItem) {
        fullContext.push(...previousItem.fullContext);
      }
    }
    if (typeof request.input === "string") {
      fullContext.push({
        type: "message",
        role: "user",
        content: request.input,
      });
    } else if (request.input) {
      fullContext.push(...request.input);
    }
    fullContext.push(...response.output);
    await this.setItem({ request, response, fullContext });
  }

  async hydrateRequest(
    request: ResponseCreateParamsBase,
  ): Promise<ResponseCreateParamsBase> {
    if (!request.previous_response_id) {
      return request;
    }
    const previousItem = await this.get(request.previous_response_id);
    if (!previousItem) {
      return request;
    }
    const hydratedRequest: ResponseCreateParamsBase = {
      ...request,
    };
    hydratedRequest.input = [...previousItem.fullContext];
    if (typeof request.input === "string") {
      hydratedRequest.input.push({
        type: "message",
        role: "user",
        content: request.input,
      });
    } else if (request.input) {
      hydratedRequest.input.push(...request.input);
    }
    return hydratedRequest;
  }

  protected abstract setItem(item: ResponsesStoreItem): Promise<void>;
}

class InMemoryResponsesStore extends ResponsesStore {
  private items: Map<string, ResponsesStoreItem> = new Map();

  async get(responseId: string): Promise<ResponsesStoreItem | null> {
    return this.items.get(responseId) ?? null;
  }

  protected async setItem(item: ResponsesStoreItem): Promise<void> {
    this.items.set(item.response.id, item);
  }
}

export class ResponsesStoreFactory {
  private static storeCache: ResponsesStore | null = null;

  static getStore(c: Context<ContextEnv>): ResponsesStore {
    if (!this.storeCache) {
      const cfg = getConfig(c);
      switch (cfg.responses_store.type) {
        case "in_memory":
          this.storeCache = new InMemoryResponsesStore();
          break;
        default:
          throw new HTTPException(500, {
            message: `Unsupported responses store type: ${cfg.responses_store.type}`,
          });
      }
    }
    return this.storeCache;
  }
}
