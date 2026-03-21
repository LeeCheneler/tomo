import { parseSSEStream } from "./sse";

/** A model available from the provider. */
export interface ModelInfo {
  id: string;
}

/** Fetches available models from an OpenAI-compatible /v1/models endpoint. */
export async function fetchModels(baseUrl: string): Promise<ModelInfo[]> {
  const url = `${baseUrl.replace(/\/+$/, "")}/v1/models`;

  let response: Response;
  try {
    response = await fetch(url);
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

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

export interface CompletionOptions {
  baseUrl: string;
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface CompletionStream {
  content: AsyncIterable<string>;
  getUsage: () => TokenUsage | null;
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
  const { baseUrl, model, messages, maxTokens, signal } = options;
  const url = `${baseUrl.replace(/\/+$/, "")}/v1/chat/completions`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        stream_options: { include_usage: true },
        ...(maxTokens != null && { max_tokens: maxTokens }),
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

  async function* streamContent(): AsyncGenerator<string> {
    for await (const data of parseSSEStream(responseBody)) {
      try {
        const chunk = JSON.parse(data);
        const content = chunk.choices?.[0]?.delta?.content;
        if (content) {
          yield content;
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
  };
}
