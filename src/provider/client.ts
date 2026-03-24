import { parseSSEStream } from "./sse";

/** A model available from the provider. */
export interface ModelInfo {
  id: string;
}

/**
 * Resolves the API key for a provider.
 * Uses the config apiKey if set, otherwise falls back to a conventional env var.
 */
export function resolveApiKey(
  providerType: string,
  configApiKey?: string,
): string | undefined {
  if (configApiKey) return configApiKey;
  const envVarMap: Record<string, string> = {
    openai: "OPENAI_API_KEY",
  };
  const envVar = envVarMap[providerType];
  return envVar ? process.env[envVar] : undefined;
}

function buildHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

/** Fetches available models from an OpenAI-compatible /v1/models endpoint. */
export async function fetchModels(
  baseUrl: string,
  apiKey?: string,
): Promise<ModelInfo[]> {
  const url = `${baseUrl.replace(/\/+$/, "")}/v1/models`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: buildHeaders(apiKey),
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        `Failed to connect to provider at ${url}: ${error.message}`,
      );
    }
    throw error;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Provider returned HTTP ${response.status}${body ? `: ${body}` : ""}`,
    );
  }

  const json = await response.json();
  const models = (json.data ?? []) as Array<{ id: string }>;
  return models.map((m) => ({ id: m.id }));
}

const DEFAULT_CONTEXT_WINDOW = 8192;

const contextWindowCache = new Map<string, number>();

/** Clears the context window cache. Exported for testing. */
export function clearContextWindowCache(): void {
  contextWindowCache.clear();
}

/**
 * Fetches the context window size for a model.
 * Dispatches to provider-specific detection based on `providerType`.
 * Only Ollama supports detection — other types return the default.
 * Results are cached per `baseUrl + model` key.
 */
export async function fetchContextWindow(
  baseUrl: string,
  model: string,
  providerType: string,
): Promise<number> {
  if (providerType !== "ollama") return DEFAULT_CONTEXT_WINDOW;

  const cacheKey = `${baseUrl}::${model}`;
  const cached = contextWindowCache.get(cacheKey);
  if (cached !== undefined) return cached;

  const url = `${baseUrl.replace(/\/+$/, "")}/api/show`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    });

    if (!response.ok) return DEFAULT_CONTEXT_WINDOW;

    const json = await response.json();
    const modelInfo = json.model_info;

    // Ollama stores context length under `<arch>.context_length` where
    // the arch prefix varies per model. Find any matching key.
    let contextLength: number | null = null;
    if (modelInfo && typeof modelInfo === "object") {
      for (const key of Object.keys(modelInfo)) {
        if (key.endsWith(".context_length")) {
          const val = modelInfo[key];
          if (typeof val === "number") {
            contextLength = val;
            break;
          }
        }
      }
    }

    const result = contextLength ?? DEFAULT_CONTEXT_WINDOW;
    contextWindowCache.set(cacheKey, result);
    return result;
  } catch {
    return DEFAULT_CONTEXT_WINDOW;
  }
}

/** Returns the default context window size used when detection fails. */
export function getDefaultContextWindow(): number {
  return DEFAULT_CONTEXT_WINDOW;
}

export interface ToolCallFunction {
  name: string;
  arguments: string;
}

export interface ToolCall {
  id: string;
  function: ToolCallFunction;
}

export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage =
  | { role: "user"; content: string | ContentPart[] }
  | { role: "system"; content: string }
  | { role: "assistant"; content: string; tool_calls?: ToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string };

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface CompletionOptions {
  baseUrl: string;
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  signal?: AbortSignal;
  tools?: ToolDefinition[];
  apiKey?: string;
}

export interface CompletionStream {
  content: AsyncIterable<string>;
  getUsage: () => TokenUsage | null;
  getToolCalls: () => ToolCall[];
}

/**
 * Streams chat completion tokens from an OpenAI-compatible endpoint.
 * Sends a POST to `/v1/chat/completions` with `stream: true` and
 * `stream_options.include_usage` to capture token counts.
 *
 * Returns a `CompletionStream` with an async iterable of content strings
 * and a `getUsage()` accessor that returns token counts after the stream ends.
 */
export async function streamChatCompletion(
  options: CompletionOptions,
): Promise<CompletionStream> {
  const { baseUrl, model, messages, maxTokens, signal, tools, apiKey } =
    options;
  const url = `${baseUrl.replace(/\/+$/, "")}/v1/chat/completions`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: buildHeaders(apiKey),
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        stream_options: { include_usage: true },
        ...(maxTokens != null && { max_tokens: maxTokens }),
        ...(tools && tools.length > 0 && { tools }),
      }),
      signal,
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(
        `Failed to connect to provider at ${url}: ${error.message}`,
      );
    }
    throw error;
  }

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Provider returned HTTP ${response.status}${body ? `: ${body}` : ""}`,
    );
  }

  if (!response.body) {
    throw new Error("Provider returned an empty response body");
  }

  const responseBody = response.body;
  let usage: TokenUsage | null = null;
  const toolCalls: ToolCall[] = [];

  async function* streamContent(): AsyncGenerator<string> {
    for await (const data of parseSSEStream(responseBody)) {
      try {
        const chunk = JSON.parse(data);
        const delta = chunk.choices?.[0]?.delta;
        if (delta?.content) {
          yield delta.content;
        }
        // Accumulate tool_calls deltas. The first chunk for a tool call
        // carries the id and function name; subsequent chunks append to
        // the arguments string.
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx: number = tc.index;
            if (!toolCalls[idx]) {
              toolCalls[idx] = {
                id: tc.id ?? "",
                function: {
                  name: tc.function?.name ?? "",
                  arguments: tc.function?.arguments ?? "",
                },
              };
            } else {
              if (tc.id) toolCalls[idx].id = tc.id;
              if (tc.function?.name)
                toolCalls[idx].function.name = tc.function.name;
              if (tc.function?.arguments) {
                toolCalls[idx].function.arguments += tc.function.arguments;
              }
            }
          }
        }
        if (chunk.usage) {
          usage = {
            promptTokens: chunk.usage.prompt_tokens ?? 0,
            completionTokens: chunk.usage.completion_tokens ?? 0,
          };
        }
      } catch {
        // Skip malformed JSON in SSE data
      }
    }
  }

  return {
    content: streamContent(),
    getUsage: () => usage,
    getToolCalls: () => toolCalls,
  };
}
