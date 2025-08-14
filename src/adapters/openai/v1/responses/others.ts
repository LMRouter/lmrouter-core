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
  ResponseFunctionToolCall,
  ResponseOutputItem,
  ResponseOutputMessage,
  ResponseOutputRefusal,
  ResponseOutputText,
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
import { ResponsesStoreFactory } from "../../../../utils/responses-store.js";

export class OpenAIResponsesOthersAdapter implements OpenAIResponsesAdapter {
  response: Response | undefined;

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
      this.convertRequest(
        await ResponsesStoreFactory.getStore().hydrateRequest(request),
      ),
      {
        maxTokens: options?.maxTokens,
      },
    );
    return this.convertResponse(response, request);
  }

  async *sendRequestStreaming(
    provider: LMRouterCoreConfigProvider,
    request: ResponseCreateParamsBase,
    options?: OpenAIResponsesInputOptions,
  ): AsyncGenerator<ResponseStreamEvent> {
    const adapter = this.getAdapter(provider);
    const stream = adapter.sendRequestStreaming(
      provider,
      this.convertRequest(
        await ResponsesStoreFactory.getStore().hydrateRequest(request),
      ),
      {
        maxTokens: options?.maxTokens,
      },
    );
    for await (const chunk of this.convertStream(stream, request)) {
      if (chunk.type === "response.completed") {
        this.response = chunk.response;
      }
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

  convertResponse(
    response: ChatCompletion,
    request: ResponseCreateParamsBase,
  ): Response {
    return {
      id: response.id,
      created_at: response.created,
      output_text: response.choices[0].message.content ?? "",
      error: null,
      incomplete_details:
        response.choices[0].finish_reason === "length"
          ? {
              reason: "max_output_tokens" as const,
            }
          : response.choices[0].finish_reason === "content_filter"
            ? {
                reason: "content_filter" as const,
              }
            : null,
      instructions: request.instructions ?? null,
      metadata: request.metadata ?? null,
      model: response.model,
      object: "response" as const,
      output: (
        (response.choices[0].message.content ||
        response.choices[0].message.refusal
          ? [
              {
                type: "message" as const,
                id: response.id,
                role: "assistant" as const,
                status: "completed" as const,
                content: (
                  (response.choices[0].message.content
                    ? [
                        {
                          type: "output_text" as const,
                          text: response.choices[0].message.content,
                          annotations: response.choices[0].message.annotations
                            ? response.choices[0].message.annotations.map(
                                (anno) => ({
                                  type: "url_citation" as const,
                                  start_index: anno.url_citation.start_index,
                                  end_index: anno.url_citation.end_index,
                                  title: anno.url_citation.title,
                                  url: anno.url_citation.url,
                                }),
                              )
                            : [],
                          logprobs: response.choices[0].logprobs?.content?.map(
                            (logprob) => ({
                              token: logprob.token,
                              bytes: logprob.bytes ?? [],
                              logprob: logprob.logprob,
                              top_logprobs: logprob.top_logprobs.map(
                                (topLogprob) => ({
                                  token: topLogprob.token,
                                  bytes: topLogprob.bytes ?? [],
                                  logprob: topLogprob.logprob,
                                }),
                              ),
                            }),
                          ),
                        },
                      ]
                    : []) as (ResponseOutputText | ResponseOutputRefusal)[]
                ).concat(
                  response.choices[0].message.refusal
                    ? [
                        {
                          type: "refusal" as const,
                          refusal: response.choices[0].message.refusal,
                        },
                      ]
                    : [],
                ),
              },
            ]
          : []) as ResponseOutputItem[]
      ).concat(
        response.choices[0].message.tool_calls?.map((toolCall) => ({
          type: "function_call" as const,
          call_id: toolCall.id,
          name: toolCall.function.name,
          arguments: toolCall.function.arguments,
          id: response.id,
          status: "completed" as const,
        })) ?? [],
      ),
      parallel_tool_calls: request.parallel_tool_calls ?? true,
      temperature: request.temperature ?? null,
      tool_choice: request.tool_choice ?? "auto",
      tools: request.tools ?? [],
      top_p: request.top_p ?? null,
      background: request.background,
      max_output_tokens: request.max_output_tokens,
      previous_response_id: request.previous_response_id,
      prompt: request.prompt,
      prompt_cache_key: request.prompt_cache_key,
      reasoning: request.reasoning,
      safety_identifier: request.safety_identifier,
      service_tier: response.service_tier,
      status: "completed" as const,
      text: request.text,
      truncation: request.truncation,
      usage: response.usage
        ? {
            input_tokens: response.usage.prompt_tokens,
            input_tokens_details: {
              cached_tokens:
                response.usage.prompt_tokens_details?.cached_tokens ?? 0,
            },
            output_tokens: response.usage.completion_tokens,
            output_tokens_details: {
              reasoning_tokens:
                response.usage.completion_tokens_details?.reasoning_tokens ?? 0,
            },
            total_tokens: response.usage.total_tokens,
          }
        : undefined,
      user: request.user,
    };
  }

  async *convertStream(
    stream: AsyncGenerator<ChatCompletionChunk>,
    request: ResponseCreateParamsBase,
  ): AsyncGenerator<ResponseStreamEvent> {
    enum State {
      Init,
      SendingText,
      SendingToolUse,
    }

    let state = State.Init;
    let sequenceNumber = 0;
    let outputIndex = 0;
    let currentResponse: Response | null = null;

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

    const responseCreated = (): ResponseStreamEvent => {
      return {
        type: "response.created" as const,
        sequence_number: sequenceNumber++,
        response: currentResponse!,
      };
    };

    const responseInProgress = (): ResponseStreamEvent => {
      return {
        type: "response.in_progress" as const,
        sequence_number: sequenceNumber++,
        response: currentResponse!,
      };
    };

    const responseAdded = function* (
      chunk: ChatCompletionChunk,
    ): Generator<ResponseStreamEvent> {
      const chunkType = getChunkType(chunk);
      if (chunkType === State.SendingText) {
        const outputItemAdded: ResponseStreamEvent = {
          type: "response.output_item.added" as const,
          sequence_number: sequenceNumber++,
          output_index: outputIndex,
          item: {
            id: chunk.id,
            type: "message" as const,
            status: "in_progress",
            content: [],
            role: "assistant" as const,
          },
        };
        currentResponse!.output.push(outputItemAdded.item);
        yield outputItemAdded;
        const contentPartAdded: ResponseStreamEvent = {
          type: "response.content_part.added" as const,
          sequence_number: sequenceNumber++,
          item_id: chunk.id,
          output_index: outputIndex,
          content_index: 0,
          part: {
            type: "output_text" as const,
            annotations: [],
            logprobs: [],
            text: "",
          },
        };
        (
          currentResponse!.output[outputIndex] as ResponseOutputMessage
        ).content.push(contentPartAdded.part);
        yield contentPartAdded;
      } else if (chunkType === State.SendingToolUse) {
        const outputItemAdded: ResponseStreamEvent = {
          type: "response.output_item.added" as const,
          sequence_number: sequenceNumber++,
          output_index: outputIndex,
          item: {
            id: chunk.id,
            type: "function_call" as const,
            status: "in_progress",
            arguments: "",
            call_id: chunk.choices[0].delta.tool_calls?.[0].id ?? "",
            name: chunk.choices[0].delta.tool_calls?.[0].function?.name ?? "",
          },
        };
        currentResponse!.output.push(outputItemAdded.item);
        yield outputItemAdded;
      }
    };

    const responseDelta = (chunk: ChatCompletionChunk): ResponseStreamEvent => {
      if (getChunkType(chunk) === State.SendingText) {
        const outputTextDelta: ResponseStreamEvent = {
          type: "response.output_text.delta" as const,
          sequence_number: sequenceNumber++,
          item_id: chunk.id,
          output_index: outputIndex,
          content_index: 0,
          delta: chunk.choices[0].delta.content ?? "",
          logprobs:
            chunk.choices[0].logprobs?.content?.map((logprob) => ({
              token: logprob.token,
              bytes: logprob.bytes ?? [],
              logprob: logprob.logprob,
            })) ?? [],
        };
        (
          (currentResponse!.output[outputIndex] as ResponseOutputMessage)
            .content[0] as ResponseOutputText
        ).text += outputTextDelta.delta;
        currentResponse!.output_text += outputTextDelta.delta;
        return outputTextDelta;
      }
      const functionCallArgumentsDelta: ResponseStreamEvent = {
        type: "response.function_call_arguments.delta" as const,
        sequence_number: sequenceNumber++,
        item_id: chunk.id,
        output_index: outputIndex,
        delta: chunk.choices[0].delta.tool_calls?.[0].function?.arguments ?? "",
      };
      (
        currentResponse!.output[outputIndex] as ResponseFunctionToolCall
      ).arguments += functionCallArgumentsDelta.delta;
      return functionCallArgumentsDelta;
    };

    const responseDones = function* (): Generator<ResponseStreamEvent> {
      if (state === State.SendingText) {
        const output = currentResponse!.output[
          outputIndex
        ] as ResponseOutputMessage;
        output.status = "completed";
        yield {
          type: "response.output_text.done" as const,
          sequence_number: sequenceNumber++,
          item_id: output.id,
          output_index: outputIndex,
          content_index: 0,
          text: (output.content[0] as ResponseOutputText).text,
          logprobs: (output.content[0] as ResponseOutputText).logprobs ?? [],
        };
        yield {
          type: "response.content_part.done" as const,
          sequence_number: sequenceNumber++,
          item_id: output.id,
          output_index: outputIndex,
          content_index: 0,
          part: output.content[0],
        };
      } else if (state === State.SendingToolUse) {
        const output = currentResponse!.output[
          outputIndex
        ] as ResponseFunctionToolCall;
        output.status = "completed";
        yield {
          type: "response.function_call_arguments.done" as const,
          sequence_number: sequenceNumber++,
          item_id: output.id ?? "",
          output_index: outputIndex,
          arguments: output.arguments,
        };
      }
      yield {
        type: "response.output_item.done" as const,
        sequence_number: sequenceNumber++,
        output_index: outputIndex,
        item: currentResponse!.output[outputIndex],
      };
    };

    const responseCompleted = (): ResponseStreamEvent => {
      currentResponse!.status = "completed";
      return {
        type: "response.completed" as const,
        sequence_number: sequenceNumber++,
        response: currentResponse!,
      };
    };

    for await (const chunk of stream) {
      if (chunk.usage) {
        currentResponse!.usage = {
          input_tokens: chunk.usage.prompt_tokens,
          input_tokens_details: {
            cached_tokens:
              chunk.usage.prompt_tokens_details?.cached_tokens ?? 0,
          },
          output_tokens: chunk.usage.completion_tokens,
          output_tokens_details: {
            reasoning_tokens:
              chunk.usage.completion_tokens_details?.reasoning_tokens ?? 0,
          },
          total_tokens: chunk.usage.total_tokens,
        };
      }
      if (
        chunk.choices.length === 0 ||
        Object.keys(chunk.choices[0].delta).length === 0
      ) {
        continue;
      }

      const chunkType = getChunkType(chunk);
      if (state === State.Init) {
        currentResponse = {
          id: chunk.id,
          object: "response" as const,
          created_at: chunk.created,
          status: "in_progress",
          background: request.background,
          error: null,
          incomplete_details: null,
          instructions: request.instructions ?? null,
          max_output_tokens: request.max_output_tokens,
          model: chunk.model,
          output: [],
          parallel_tool_calls: request.parallel_tool_calls ?? true,
          previous_response_id: request.previous_response_id,
          prompt_cache_key: request.prompt_cache_key,
          reasoning: request.reasoning,
          safety_identifier: request.safety_identifier,
          service_tier: chunk.service_tier,
          temperature: request.temperature ?? null,
          text: request.text,
          tool_choice: request.tool_choice ?? "auto",
          tools: request.tools ?? [],
          top_p: request.top_p ?? null,
          truncation: request.truncation,
          usage: {
            input_tokens: 0,
            input_tokens_details: {
              cached_tokens: 0,
            },
            output_tokens: 0,
            output_tokens_details: {
              reasoning_tokens: 0,
            },
            total_tokens: 0,
          },
          user: request.user,
          metadata: request.metadata ?? null,
          output_text: "",
        };
        yield responseCreated();
        yield responseInProgress();
        yield* responseAdded(chunk);
        if (hasContent(chunk)) {
          yield responseDelta(chunk);
        }
        state = chunkType;
      } else if (chunkType === state) {
        yield responseDelta(chunk);
      } else {
        yield* responseDones();
        outputIndex++;
        yield* responseAdded(chunk);
        if (hasContent(chunk)) {
          yield responseDelta(chunk);
        }
        state = chunkType;
      }
    }
    if (state !== State.Init) {
      yield* responseDones();
      yield responseCompleted();
    }
  }
}
