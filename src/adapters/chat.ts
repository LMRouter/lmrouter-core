import { Stream as AnthropicStream } from "@anthropic-ai/sdk/core/streaming";
import type {
  ContentBlock,
  ImageBlockParam,
  Message,
  MessageCreateParamsBase,
  MessageDeltaUsage,
  RawMessageStreamEvent,
  StopReason,
  Tool,
} from "@anthropic-ai/sdk/resources/messages";
import { Stream as OpenAIStream } from "openai/core/streaming";
import type { FunctionParameters } from "openai/resources";
import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsBase,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";

export const chatCompletionAdapters = {
  openai: {
    requestToAnthropic: (
      request: ChatCompletionCreateParamsBase,
      maxTokens?: number,
    ): MessageCreateParamsBase => {
      const disableParallelToolUse =
        request.parallel_tool_calls !== undefined
          ? !request.parallel_tool_calls
          : undefined;

      return {
        max_tokens:
          request.max_completion_tokens ??
          request.max_tokens ??
          maxTokens ??
          8192,
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
                      media_type: part.image_url.url
                        .split(";")[0]
                        .split(":")[1],
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
          (message) =>
            message.role === "system" || message.role === "developer",
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
    },
    responseToAnthropic: (response: ChatCompletion): Message => {
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
    },
    streamToAnthropic: async function* (
      stream: OpenAIStream<ChatCompletionChunk>,
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
        if (state == State.Init) {
          yield {
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
          if (chunk.choices[0].delta.tool_calls) {
            yield {
              type: "content_block_start",
              index: blockCount,
              content_block: {
                type: "tool_use" as const,
                id: chunk.choices[0].delta.tool_calls[0].id ?? "",
                name: chunk.choices[0].delta.tool_calls[0].function?.name ?? "",
                input: {},
              },
            };
            if (
              typeof chunk.choices[0].delta.tool_calls[0].function
                ?.arguments === "string" &&
              chunk.choices[0].delta.tool_calls[0].function?.arguments.length >
                0
            ) {
              yield {
                type: "content_block_delta",
                index: blockCount,
                delta: {
                  type: "input_json_delta" as const,
                  partial_json:
                    chunk.choices[0].delta.tool_calls[0].function.arguments,
                },
              };
            }
            state = State.SendingToolUse;
          } else {
            yield {
              type: "content_block_start",
              index: blockCount,
              content_block: {
                type: "text" as const,
                text: "",
                citations: null,
              },
            };
            if (
              typeof chunk.choices[0].delta.content === "string" &&
              chunk.choices[0].delta.content.length > 0
            ) {
              yield {
                type: "content_block_delta",
                index: blockCount,
                delta: {
                  type: "text_delta" as const,
                  text: chunk.choices[0].delta.content,
                },
              };
            }
            state = State.SendingText;
          }
        } else if (state == State.SendingText) {
          if (chunk.choices[0].delta.tool_calls) {
            yield {
              type: "content_block_stop",
              index: blockCount,
            };
            blockCount++;
            yield {
              type: "content_block_start",
              index: blockCount,
              content_block: {
                type: "tool_use" as const,
                id: chunk.choices[0].delta.tool_calls[0].id ?? "",
                name: chunk.choices[0].delta.tool_calls[0].function?.name ?? "",
                input: {},
              },
            };
            if (
              typeof chunk.choices[0].delta.tool_calls[0].function
                ?.arguments === "string" &&
              chunk.choices[0].delta.tool_calls[0].function?.arguments.length >
                0
            ) {
              yield {
                type: "content_block_delta",
                index: blockCount,
                delta: {
                  type: "input_json_delta" as const,
                  partial_json:
                    chunk.choices[0].delta.tool_calls[0].function.arguments,
                },
              };
            }
            state = State.SendingToolUse;
          } else {
            yield {
              type: "content_block_delta",
              index: blockCount,
              delta: {
                type: "text_delta" as const,
                text: chunk.choices[0].delta.content ?? "",
              },
            };
          }
        } else if (state == State.SendingToolUse) {
          if (chunk.choices[0].delta.tool_calls) {
            yield {
              type: "content_block_delta",
              index: blockCount,
              delta: {
                type: "input_json_delta" as const,
                partial_json:
                  chunk.choices[0].delta.tool_calls[0].function?.arguments ??
                  "",
              },
            };
          } else {
            yield {
              type: "content_block_stop",
              index: blockCount,
            };
            blockCount++;
            yield {
              type: "content_block_start",
              index: blockCount,
              content_block: {
                type: "text" as const,
                text: "",
                citations: null,
              },
            };
            if (
              typeof chunk.choices[0].delta.content === "string" &&
              chunk.choices[0].delta.content.length > 0
            ) {
              yield {
                type: "content_block_delta",
                index: blockCount,
                delta: {
                  type: "text_delta" as const,
                  text: chunk.choices[0].delta.content,
                },
              };
            }
            state = State.SendingText;
          }
        }
      }
      if (state !== State.Init) {
        yield {
          type: "content_block_stop",
          index: blockCount,
        };
        yield {
          type: "message_delta",
          delta: {
            stop_reason: stopReason,
            stop_sequence: null,
          },
          usage,
        };
        yield {
          type: "message_stop",
        };
      }
    },
  },
  anthropic: {
    requestToOpenai: (
      request: MessageCreateParamsBase,
    ): ChatCompletionCreateParamsBase => {
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
                return {
                  role: "tool" as const,
                  tool_call_id: message.content[0].tool_use_id,
                  content:
                    typeof message.content[0].content === "string"
                      ? message.content[0].content
                      : (message.content[0].content
                          ?.filter((part) => part.type === "text")
                          .map((part) => part.text)
                          .join("") ?? ""),
                };
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
                  .filter(
                    (part) => part.type === "text" || part.type === "image",
                  )
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
            .filter((message) => message !== undefined),
        ),
        model: request.model,
        // TODO: Fix this workaround for Claude Code
        max_completion_tokens: Math.min(request.max_tokens, 16384),
        parallel_tool_calls:
          request.tool_choice !== undefined &&
          request.tool_choice.type !== "none"
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
        user: request.metadata?.user_id ?? undefined,
      };
    },
    responseToOpenai: (response: Message): ChatCompletion => {
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
    },
    streamToOpenai: async function* (
      stream: AnthropicStream<RawMessageStreamEvent>,
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
              event.usage.output_tokens +
              (messageStart?.usage.input_tokens ?? 0),
            prompt_tokens_details: {
              cached_tokens:
                messageStart?.usage.cache_read_input_tokens ?? undefined,
            },
          };
          yield chunk2;
        }
      }
    },
  },
};
