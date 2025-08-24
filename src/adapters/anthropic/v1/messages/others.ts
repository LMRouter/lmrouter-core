// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import type {
  ContentBlock,
  Message,
  MessageCreateParamsBase,
  MessageDeltaUsage,
  RawMessageStreamEvent,
  StopReason,
  Tool,
} from "@anthropic-ai/sdk/resources/messages";
import type { FunctionParameters } from "openai/resources";
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsBase,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";

import type {
  AnthropicMessagesAdapter,
  AnthropicMessagesInputOptions,
} from "./adapter.js";
import {
  type OpenAIChatCompletionAdapter,
  OpenAIChatCompletionAdapterFactory,
} from "../../../openai/v1/chat/adapter.js";
import type {
  LMRouterConfigModelProviderPricing,
  LMRouterConfigProvider,
} from "../../../../utils/config.js";

export class AnthropicMessagesOthersAdapter
  implements AnthropicMessagesAdapter
{
  usage?: LMRouterConfigModelProviderPricing;

  getAdapter(provider: LMRouterConfigProvider): OpenAIChatCompletionAdapter {
    return OpenAIChatCompletionAdapterFactory.getAdapter(provider);
  }

  async sendRequest(
    provider: LMRouterConfigProvider,
    request: MessageCreateParamsBase,
    options?: AnthropicMessagesInputOptions,
  ): Promise<Message> {
    const adapter = this.getAdapter(provider);
    const response = await adapter.sendRequest(
      provider,
      this.convertRequest(request, options?.maxTokens),
    );
    this.usage = adapter.usage;
    return this.convertResponse(response);
  }

  async *sendRequestStreaming(
    provider: LMRouterConfigProvider,
    request: MessageCreateParamsBase,
    options?: AnthropicMessagesInputOptions,
  ): AsyncGenerator<RawMessageStreamEvent> {
    const adapter = this.getAdapter(provider);
    const stream = adapter.sendRequestStreaming(
      provider,
      this.convertRequest(request, options?.maxTokens),
    );
    yield* this.convertStream(stream);
    this.usage = adapter.usage;
  }

  convertRequest(
    request: MessageCreateParamsBase,
    maxTokens?: number,
  ): ChatCompletionCreateParamsBase {
    return {
      messages: (
        (request.system
          ? [
              {
                role: "system" as const,
                content:
                  typeof request.system === "string"
                    ? request.system
                    : request.system.map((part) => part.text).join(""),
              },
            ]
          : []) as ChatCompletionMessageParam[]
      ).concat(
        request.messages
          .map((message) => {
            if (!message.content) {
              return;
            }
            if (typeof message.content === "string") {
              return {
                role: message.role,
                content: message.content,
              };
            }
            if (message.content[0].type === "tool_result") {
              return message.content
                .filter((part) => part.type === "tool_result")
                .map((part) => ({
                  role: "tool" as const,
                  tool_call_id: part.tool_use_id,
                  content:
                    typeof part.content === "string"
                      ? part.content
                      : (part.content
                          ?.filter((part) => part.type === "text")
                          .map((part) => part.text)
                          .join("") ?? ""),
                }));
            }
            if (
              message.content.filter((part) => part.type === "tool_use")
                .length > 0
            ) {
              return {
                role: "assistant" as const,
                content: message.content
                  .filter((part) => part.type === "text")
                  .map((part) => part.text)
                  .join(""),
                tool_calls: message.content
                  .filter((part) => part.type === "tool_use")
                  .map((part, index) => ({
                    index,
                    id: part.id,
                    type: "function" as const,
                    function: {
                      name: part.name,
                      arguments: JSON.stringify(part.input),
                    },
                  })),
              };
            }
            if (message.role === "assistant") {
              return {
                role: "assistant" as const,
                content: message.content
                  .filter((part) => part.type === "text")
                  .map((part) => part.text)
                  .join(""),
              };
            }
            return {
              role: "user" as const,
              content: message.content
                .filter((part) => part.type === "text" || part.type === "image")
                .map((part) => {
                  if (part.type === "text") {
                    return {
                      type: "text" as const,
                      text: part.text,
                    };
                  }
                  return {
                    type: "image_url" as const,
                    image_url: {
                      url:
                        part.source.type === "url"
                          ? part.source.url
                          : `data:${part.source.media_type};base64,${part.source.data}`,
                    },
                  };
                }),
            };
          })
          .filter((message) => message !== undefined)
          .flat(),
      ),
      model: request.model,
      max_completion_tokens: Math.min(request.max_tokens, maxTokens ?? 16384),
      parallel_tool_calls:
        request.tool_choice !== undefined && request.tool_choice.type !== "none"
          ? !request.tool_choice.disable_parallel_tool_use
          : undefined,
      reasoning_effort:
        request.thinking?.type === "enabled"
          ? request.thinking.budget_tokens <= 1024
            ? "low"
            : request.thinking.budget_tokens <= 8192
              ? "medium"
              : "high"
          : undefined,
      stop: request.stop_sequences,
      stream: request.stream,
      stream_options: request.stream
        ? {
            include_usage: true,
          }
        : undefined,
      temperature: request.temperature,
      tool_choice:
        request.tool_choice?.type === "auto"
          ? "auto"
          : request.tool_choice?.type === "any"
            ? "required"
            : request.tool_choice?.type === "none"
              ? "none"
              : request.tool_choice?.type === "tool"
                ? {
                    type: "function" as const,
                    function: {
                      name: request.tool_choice.name,
                    },
                  }
                : undefined,
      tools: request.tools?.map((tool) => ({
        type: "function" as const,
        function: {
          name: tool.name,
          description: (tool as Tool).description,
          parameters: (tool as Tool).input_schema as FunctionParameters,
        },
      })),
      top_p: request.top_p,
      // Some providers, like OpenRouter, don't support user strings longer than 128 characters, so we truncate it
      user: request.metadata?.user_id
        ? request.metadata.user_id.slice(0, 128)
        : undefined,
    };
  }

  convertResponse(response: ChatCompletion): Message {
    return {
      id: response.id,
      content: (
        (response.choices[0].message.content
          ? [
              {
                type: "text" as const,
                text: response.choices[0].message.content,
              },
            ]
          : []) as ContentBlock[]
      ).concat(
        response.choices[0].message.tool_calls?.map((toolCall) => ({
          type: "tool_use" as const,
          id: toolCall.id,
          name: toolCall.function.name,
          input: JSON.parse(toolCall.function.arguments),
        })) ?? [],
      ),
      model: response.model,
      role: "assistant" as const,
      stop_reason:
        response.choices[0].finish_reason === "stop"
          ? "end_turn"
          : response.choices[0].finish_reason === "length"
            ? "max_tokens"
            : response.choices[0].finish_reason === "tool_calls" ||
                response.choices[0].finish_reason === "function_call"
              ? "tool_use"
              : response.choices[0].finish_reason === "content_filter"
                ? "refusal"
                : null,
      stop_sequence: null,
      type: "message",
      usage: {
        cache_creation_input_tokens: null,
        cache_read_input_tokens:
          response.usage?.prompt_tokens_details?.cached_tokens ?? null,
        input_tokens: response.usage?.prompt_tokens ?? 0,
        output_tokens: response.usage?.completion_tokens ?? 0,
        server_tool_use: null,
        service_tier:
          response.service_tier === "default"
            ? "standard"
            : response.service_tier === "priority"
              ? "priority"
              : null,
      },
    };
  }

  async *convertStream(
    stream: AsyncGenerator<ChatCompletionChunk>,
  ): AsyncGenerator<RawMessageStreamEvent> {
    enum State {
      Init,
      SendingText,
      SendingToolUse,
    }

    let state = State.Init;
    let blockCount = 0;
    let stopReason: StopReason | null = null;
    const usage: MessageDeltaUsage = {
      cache_creation_input_tokens: null,
      cache_read_input_tokens: null,
      input_tokens: 0,
      output_tokens: 0,
      server_tool_use: null,
    };

    const getChunkType = (
      chunk: ChatCompletionChunk,
    ): State.SendingText | State.SendingToolUse => {
      if (chunk.choices[0].delta.tool_calls) {
        return State.SendingToolUse;
      }
      return State.SendingText;
    };

    const hasContent = (chunk: ChatCompletionChunk): boolean => {
      const chunkType = getChunkType(chunk);
      return (
        (chunkType === State.SendingText &&
          typeof chunk.choices[0].delta.content === "string" &&
          chunk.choices[0].delta.content.length > 0) ||
        (chunkType === State.SendingToolUse &&
          typeof chunk.choices[0].delta.tool_calls?.[0].function?.arguments ===
            "string" &&
          chunk.choices[0].delta.tool_calls?.[0].function?.arguments.length > 0)
      );
    };

    const messageStart = (
      chunk: ChatCompletionChunk,
    ): RawMessageStreamEvent => {
      return {
        type: "message_start",
        message: {
          id: chunk.id,
          type: "message" as const,
          role: "assistant" as const,
          model: chunk.model,
          content: [],
          stop_reason: null,
          stop_sequence: null,
          usage: {
            cache_creation_input_tokens: null,
            cache_read_input_tokens: null,
            input_tokens: 0,
            output_tokens: 0,
            server_tool_use: null,
            service_tier:
              chunk.service_tier === "default"
                ? "standard"
                : chunk.service_tier === "priority"
                  ? "priority"
                  : null,
          },
        },
      };
    };

    const contentBlockStart = (
      chunk: ChatCompletionChunk,
    ): RawMessageStreamEvent => {
      if (getChunkType(chunk) === State.SendingText) {
        return {
          type: "content_block_start",
          index: blockCount,
          content_block: {
            type: "text" as const,
            text: "",
            citations: null,
          },
        };
      }
      return {
        type: "content_block_start",
        index: blockCount,
        content_block: {
          type: "tool_use" as const,
          id: chunk.choices[0].delta.tool_calls?.[0].id ?? "",
          name: chunk.choices[0].delta.tool_calls?.[0].function?.name ?? "",
          input: {},
        },
      };
    };

    const contentBlockDelta = (
      chunk: ChatCompletionChunk,
    ): RawMessageStreamEvent => {
      if (getChunkType(chunk) === State.SendingText) {
        return {
          type: "content_block_delta",
          index: blockCount,
          delta: {
            type: "text_delta" as const,
            text: chunk.choices[0].delta.content ?? "",
          },
        };
      }
      return {
        type: "content_block_delta",
        index: blockCount,
        delta: {
          type: "input_json_delta" as const,
          partial_json:
            chunk.choices[0].delta.tool_calls?.[0].function?.arguments ?? "",
        },
      };
    };

    const contentBlockStop = (): RawMessageStreamEvent => {
      return {
        type: "content_block_stop",
        index: blockCount,
      };
    };

    const messageDelta = (): RawMessageStreamEvent => {
      return {
        type: "message_delta",
        delta: {
          stop_reason: stopReason,
          stop_sequence: null,
        },
        usage,
      };
    };

    const messageStop = (): RawMessageStreamEvent => {
      return {
        type: "message_stop",
      };
    };

    for await (const chunk of stream) {
      if (chunk.choices.length > 0 && chunk.choices[0].finish_reason) {
        stopReason =
          chunk.choices[0].finish_reason === "stop"
            ? "end_turn"
            : chunk.choices[0].finish_reason === "length"
              ? "max_tokens"
              : chunk.choices[0].finish_reason === "tool_calls" ||
                  chunk.choices[0].finish_reason === "function_call"
                ? "tool_use"
                : chunk.choices[0].finish_reason === "content_filter"
                  ? "refusal"
                  : null;
      }
      if (chunk.usage) {
        usage.input_tokens = chunk.usage.prompt_tokens;
        usage.output_tokens = chunk.usage.completion_tokens;
        usage.cache_read_input_tokens =
          chunk.usage.prompt_tokens_details?.cached_tokens ?? null;
      }
      if (
        chunk.choices.length === 0 ||
        Object.keys(chunk.choices[0].delta).length === 0
      ) {
        continue;
      }

      const chunkType = getChunkType(chunk);
      if (state === State.Init) {
        yield messageStart(chunk);
        yield contentBlockStart(chunk);
        if (hasContent(chunk)) {
          yield contentBlockDelta(chunk);
        }
        state = chunkType;
      } else if (chunkType === state) {
        yield contentBlockDelta(chunk);
      } else {
        yield contentBlockStop();
        blockCount++;
        yield contentBlockStart(chunk);
        if (hasContent(chunk)) {
          yield contentBlockDelta(chunk);
        }
        state = chunkType;
      }
    }
    if (state !== State.Init) {
      yield contentBlockStop();
      yield messageDelta();
      yield messageStop();
    }
  }
}
