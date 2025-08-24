// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import type {
  ContentBlock,
  ImageBlockParam,
  Message,
  MessageCreateParamsBase,
  RawMessageStreamEvent,
  Tool,
} from "@anthropic-ai/sdk/resources/messages";
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsBase,
} from "openai/resources/chat/completions";

import type {
  OpenAIChatCompletionAdapter,
  OpenAIChatCompletionInputOptions,
} from "./adapter.js";
import {
  AnthropicMessagesAdapterFactory,
  type AnthropicMessagesAdapter,
} from "../../../anthropic/v1/messages/adapter.js";
import type {
  LMRouterConfigModelProviderPricing,
  LMRouterConfigProvider,
} from "../../../../utils/config.js";

export class OpenAIChatCompletionAnthropicAdapter
  implements OpenAIChatCompletionAdapter
{
  usage?: LMRouterConfigModelProviderPricing;

  getAdapter(provider: LMRouterConfigProvider): AnthropicMessagesAdapter {
    return AnthropicMessagesAdapterFactory.getAdapter(provider);
  }

  async sendRequest(
    provider: LMRouterConfigProvider,
    request: ChatCompletionCreateParamsBase,
    options?: OpenAIChatCompletionInputOptions,
  ): Promise<ChatCompletion> {
    const adaptor = this.getAdapter(provider);
    const completion = await adaptor.sendRequest(
      provider,
      this.convertRequest(request, options?.maxTokens),
    );
    this.usage = adaptor.usage;
    return this.convertResponse(completion as Message);
  }

  async *sendRequestStreaming(
    provider: LMRouterConfigProvider,
    request: ChatCompletionCreateParamsBase,
    options?: OpenAIChatCompletionInputOptions,
  ): AsyncGenerator<ChatCompletionChunk> {
    const adaptor = this.getAdapter(provider);
    const stream = adaptor.sendRequestStreaming(
      provider,
      this.convertRequest(request, options?.maxTokens),
    );
    yield* this.convertStream(stream);
    this.usage = adaptor.usage;
  }

  convertRequest(
    request: ChatCompletionCreateParamsBase,
    maxTokens?: number,
  ): MessageCreateParamsBase {
    const disableParallelToolUse =
      request.parallel_tool_calls !== undefined
        ? !request.parallel_tool_calls
        : undefined;

    return {
      max_tokens: Math.min(
        request.max_completion_tokens ??
          request.max_tokens ??
          maxTokens ??
          8192,
        maxTokens ?? Infinity,
      ),
      messages: request.messages
        .filter(
          (message) =>
            message.role !== "system" &&
            message.role !== "developer" &&
            message.role !== "function",
        )
        .map((message) => {
          if (message.role === "tool") {
            return {
              role: "user" as const,
              content: [
                {
                  type: "tool_result" as const,
                  tool_use_id: message.tool_call_id,
                  content:
                    typeof message.content === "string"
                      ? message.content
                      : message.content.map((part) => part.text).join(""),
                },
              ],
            };
          }
          if (message.role === "assistant" && message.tool_calls) {
            return {
              role: "assistant" as const,
              content: (
                (typeof message.content === "string" &&
                message.content.length > 0
                  ? [
                      {
                        type: "text" as const,
                        text: message.content,
                      },
                    ]
                  : []) as ContentBlock[]
              ).concat(
                message.tool_calls.map((toolCall) => ({
                  type: "tool_use" as const,
                  id: toolCall.id,
                  name: toolCall.function.name,
                  input: JSON.parse(toolCall.function.arguments),
                })),
              ),
            };
          }
          if (!message.content) {
            return;
          }
          if (typeof message.content === "string") {
            return {
              role: message.role,
              content: message.content,
            };
          }
          return {
            role: message.role,
            content: message.content
              .filter(
                (part) => part.type === "text" || part.type === "image_url",
              )
              .map((part) => {
                if (part.type === "text") {
                  return {
                    type: "text" as const,
                    text: part.text,
                  };
                }
                return {
                  type: "image" as const,
                  source: {
                    type: "base64" as const,
                    media_type: part.image_url.url.split(";")[0].split(":")[1],
                    data: part.image_url.url.split(",")[1],
                  },
                } as ImageBlockParam;
              }),
          };
        })
        .filter((message) => message !== undefined),
      model: request.model,
      metadata: {
        user_id: request.user,
      },
      stop_sequences:
        typeof request.stop === "string"
          ? [request.stop]
          : (request.stop ?? undefined),
      stream: request.stream ?? undefined,
      system: request.messages.find(
        (message) => message.role === "system" || message.role === "developer",
      )?.content,
      temperature: request.temperature ?? undefined,
      // Values taken from https://ai.google.dev/gemini-api/docs/openai#thinking
      thinking:
        request.reasoning_effort === "low"
          ? {
              budget_tokens: 1024,
              type: "enabled",
            }
          : request.reasoning_effort === "medium"
            ? {
                budget_tokens: 8192,
                type: "enabled",
              }
            : request.reasoning_effort === "high"
              ? {
                  budget_tokens: 24576,
                  type: "enabled",
                }
              : undefined,
      tool_choice:
        request.tool_choice === "none"
          ? {
              type: "none",
            }
          : request.tool_choice === "auto"
            ? {
                type: "auto",
                disable_parallel_tool_use: disableParallelToolUse,
              }
            : request.tool_choice === "required"
              ? {
                  type: "any",
                  disable_parallel_tool_use: disableParallelToolUse,
                }
              : request.tool_choice !== undefined
                ? {
                    type: "tool",
                    name: request.tool_choice.function.name,
                    disable_parallel_tool_use: disableParallelToolUse,
                  }
                : undefined,
      tools: request.tools?.map((tool) => ({
        name: tool.function.name,
        description: tool.function.description,
        input_schema: tool.function.parameters as Tool.InputSchema,
      })),
      top_p: request.top_p ?? undefined,
    };
  }

  convertResponse(response: Message): ChatCompletion {
    const choice: ChatCompletion.Choice = {
      finish_reason:
        response.stop_reason === "max_tokens"
          ? "length"
          : response.stop_reason === "tool_use"
            ? "tool_calls"
            : response.stop_reason === "refusal"
              ? "content_filter"
              : "stop",
      index: 0,
      logprobs: null,
      message: {
        role: "assistant" as const,
        content: null,
        refusal: null,
      },
    };
    for (const content of response.content) {
      if (content.type === "text") {
        if (!choice.message.content) {
          choice.message.content = "";
        }
        choice.message.content += content.text;
      } else if (content.type === "tool_use") {
        if (!choice.message.tool_calls) {
          choice.message.tool_calls = [];
        }
        choice.message.tool_calls.push({
          id: content.id,
          type: "function" as const,
          function: {
            name: content.name,
            arguments: JSON.stringify(content.input),
          },
        });
      }
    }
    return {
      id: response.id,
      choices: [choice],
      created: 0,
      model: response.model,
      object: "chat.completion",
      service_tier:
        response.usage.service_tier === "standard"
          ? "default"
          : response.usage.service_tier === "priority"
            ? "priority"
            : null,
      usage: {
        completion_tokens: response.usage.output_tokens,
        prompt_tokens: response.usage.input_tokens,
        total_tokens:
          response.usage.output_tokens + response.usage.input_tokens,
        prompt_tokens_details: {
          cached_tokens: response.usage.cache_read_input_tokens ?? undefined,
        },
      },
    };
  }

  async *convertStream(
    stream: AsyncGenerator<RawMessageStreamEvent>,
  ): AsyncGenerator<ChatCompletionChunk> {
    let messageStart: Message | null = null;
    let toolCallCount = 0;
    const getCleanChunk = (): ChatCompletionChunk => ({
      id: messageStart?.id ?? "",
      choices: [
        {
          index: 0,
          delta: {},
          logprobs: null,
          finish_reason: null,
        },
      ],
      created: 0,
      model: messageStart?.model ?? "",
      object: "chat.completion.chunk",
      service_tier:
        messageStart?.usage.service_tier === "standard"
          ? "default"
          : messageStart?.usage.service_tier === "priority"
            ? "priority"
            : null,
      usage: null,
    });
    for await (const event of stream) {
      if (event.type === "message_start") {
        messageStart = event.message;
      } else if (event.type === "content_block_start") {
        if (event.content_block.type === "text") {
          const chunk = getCleanChunk();
          chunk.choices[0].delta = {
            role: "assistant" as const,
            content: "",
            refusal: null,
          };
          yield chunk;
        } else if (event.content_block.type === "tool_use") {
          toolCallCount++;
          const chunk = getCleanChunk();
          chunk.choices[0].delta = {
            role: "assistant" as const,
            tool_calls: [
              {
                index: toolCallCount - 1,
                id: event.content_block.id,
                type: "function" as const,
                function: {
                  name: event.content_block.name,
                  arguments: "",
                },
              },
            ],
            refusal: null,
          };
          yield chunk;
        }
      } else if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          const chunk = getCleanChunk();
          chunk.choices[0].delta = {
            content: event.delta.text,
          };
          yield chunk;
        } else if (event.delta.type === "input_json_delta") {
          const chunk = getCleanChunk();
          chunk.choices[0].delta = {
            tool_calls: [
              {
                index: toolCallCount - 1,
                function: {
                  arguments: event.delta.partial_json,
                },
              },
            ],
          };
          yield chunk;
        }
      } else if (event.type === "message_delta") {
        const chunk = getCleanChunk();
        chunk.choices[0].finish_reason =
          event.delta.stop_reason === "max_tokens"
            ? "length"
            : event.delta.stop_reason === "tool_use"
              ? "tool_calls"
              : event.delta.stop_reason === "refusal"
                ? "content_filter"
                : "stop";
        yield chunk;
        const chunk2 = getCleanChunk();
        chunk2.choices = [];
        chunk2.usage = {
          completion_tokens: event.usage.output_tokens,
          prompt_tokens: messageStart?.usage.input_tokens ?? 0,
          total_tokens:
            event.usage.output_tokens + (messageStart?.usage.input_tokens ?? 0),
          prompt_tokens_details: {
            cached_tokens:
              messageStart?.usage.cache_read_input_tokens ?? undefined,
          },
        };
        yield chunk2;
      }
    }
  }
}
