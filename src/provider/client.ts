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
  const { baseUrl, model, messages, signal } = options;
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
