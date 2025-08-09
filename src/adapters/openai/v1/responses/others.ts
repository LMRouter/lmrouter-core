// SPDX-License-Identifier: MIT
// Copyright (c) 2025 LMRouter Contributors

import type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParamsBase,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import type {
  Response,
  ResponseCreateParamsBase,
  ResponseStreamEvent,
} from "openai/resources/responses/responses";

import type {
  OpenAIResponsesAdapter,
  OpenAIResponsesInputOptions,
} from "./adapter.js";
import {
  OpenAIChatCompletionAdapterFactory,
  type OpenAIChatCompletionAdapter,
} from "../chat/adapter.js";
import type { LMRouterCoreConfigProvider } from "../../../../utils/config.js";

export class OpenAIResponsesOthersAdapter implements OpenAIResponsesAdapter {
  getAdapter(
    provider: LMRouterCoreConfigProvider,
  ): OpenAIChatCompletionAdapter {
    return OpenAIChatCompletionAdapterFactory.getAdapter(provider);
  }

  async sendRequest(
    provider: LMRouterCoreConfigProvider,
    request: ResponseCreateParamsBase,
    options?: OpenAIResponsesInputOptions,
  ): Promise<Response> {
    const adapter = this.getAdapter(provider);
    const response = await adapter.sendRequest(
      provider,
      this.convertRequest(request),
      {
        maxTokens: options?.maxTokens,
      },
    );
    return this.convertResponse(response);
  }

  async *sendRequestStreaming(
    provider: LMRouterCoreConfigProvider,
    request: ResponseCreateParamsBase,
    options?: OpenAIResponsesInputOptions,
  ): AsyncGenerator<ResponseStreamEvent> {
    const adapter = this.getAdapter(provider);
    const stream = adapter.sendRequestStreaming(
      provider,
      this.convertRequest(request),
      {
        maxTokens: options?.maxTokens,
      },
    );
    for await (const chunk of this.convertStream(stream)) {
      yield chunk;
    }
  }

  convertRequest(
    request: ResponseCreateParamsBase,
  ): ChatCompletionCreateParamsBase {
    return {
      messages: (
        (request.instructions
          ? [
              {
                role: "system" as const,
                content: request.instructions,
              },
            ]
          : []) as ChatCompletionMessageParam[]
      ).concat(
        typeof request.input === "string"
          ? [
              {
                role: "user" as const,
                content: request.input,
              },
            ]
          : (request.input
              ?.map((input) =>
                input.type === "message"
                  ? input.role === "system" || input.role === "developer"
                    ? {
                        role: "system" as const,
                        content:
                          typeof input.content === "string"
                            ? input.content
                            : input.content
                                .filter(
                                  (content) => content.type === "input_text",
                                )
                                .map((content) => ({
                                  type: "text" as const,
                                  text: content.text,
                                })),
                      }
                    : input.role === "assistant"
                      ? {
                          role: "assistant" as const,
                          content:
                            typeof input.content === "string"
                              ? input.content
                              : input.content
                                  .filter(
                                    (content) =>
                                      content.type === "output_text" ||
                                      content.type === "refusal",
                                  )
                                  .map((content) =>
                                    content.type === "output_text"
                                      ? {
                                          type: "text" as const,
                                          text: content.text,
                                        }
                                      : {
                                          type: "refusal" as const,
                                          refusal: content.refusal,
                                        },
                                  ),
                        }
                      : {
                          role: "user" as const,
                          content:
                            typeof input.content === "string"
                              ? input.content
                              : input.content
                                  .filter(
                                    (content) =>
                                      content.type === "input_text" ||
                                      content.type === "input_image",
                                  )
                                  .map((content) =>
                                    content.type === "input_text"
                                      ? {
                                          type: "text" as const,
                                          text: content.text,
                                        }
                                      : {
                                          type: "image_url" as const,
                                          image_url: {
                                            url: content.image_url ?? "",
                                          },
                                        },
                                  ),
                        }
                  : input.type === "function_call"
                    ? {
                        role: "assistant" as const,
                        tool_calls: [
                          {
                            type: "function" as const,
                            id: input.call_id,
                            function: {
                              name: input.name,
                              arguments: input.arguments,
                            },
                          },
                        ],
                      }
                    : input.type === "function_call_output"
                      ? {
                          role: "tool" as const,
                          tool_call_id: input.call_id,
                          content: input.output,
                        }
                      : undefined,
              )
              .filter((input) => input !== undefined) ?? []),
      ),
      model: request.model!,
      max_completion_tokens: request.max_output_tokens,
      metadata: request.metadata,
      parallel_tool_calls: request.parallel_tool_calls ?? undefined,
      prompt_cache_key: request.prompt_cache_key,
      reasoning_effort: request.reasoning?.effort,
      response_format:
        request.text?.format?.type === "json_schema"
          ? {
              type: "json_schema" as const,
              json_schema: {
                name: request.text.format.name,
                description: request.text.format.description,
                schema: request.text.format.schema,
                strict: request.text.format.strict,
              },
            }
          : request.text?.format,
      safety_identifier: request.safety_identifier,
      service_tier: request.service_tier,
      store: request.store,
      stream: request.stream,
      stream_options: request.stream
        ? {
            include_usage: true,
          }
        : undefined,
      temperature: request.temperature,
      tool_choice:
        typeof request.tool_choice === "string"
          ? request.tool_choice
          : request.tool_choice?.type === "function"
            ? {
                type: "function" as const,
                function: {
                  name: request.tool_choice.name,
                },
              }
            : undefined,
      tools: request.tools
        ?.filter((tool) => tool.type === "function")
        .map((tool) => ({
          type: "function" as const,
          function: {
            name: tool.name,
            description: tool.description ?? undefined,
            parameters: tool.parameters ?? undefined,
            strict: tool.strict,
          },
        })),
      top_p: request.top_p,
      user: request.user,
    };
  }

  convertResponse(response: ChatCompletion): Response {
    return response as unknown as Response;
  }

  async *convertStream(
    stream: AsyncGenerator<ChatCompletionChunk>,
  ): AsyncGenerator<ResponseStreamEvent> {
    for await (const chunk of stream) {
      yield chunk as unknown as ResponseStreamEvent;
    }
  }
}
