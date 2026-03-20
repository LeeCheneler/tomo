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

export interface CompletionOptions {
  baseUrl: string;
  model: string;
  messages: ChatMessage[];
  signal?: AbortSignal;
}

/**
 * Streams chat completion tokens from an OpenAI-compatible endpoint.
 * Sends a POST to `/v1/chat/completions` with `stream: true` and
 * yields content strings as they arrive.
 */
export async function* streamChatCompletion(
  options: CompletionOptions,
): AsyncGenerator<string> {
  const { baseUrl, model, messages, signal } = options;
  const url = `${baseUrl.replace(/\/+$/, "")}/v1/chat/completions`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, stream: true }),
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

  for await (const data of parseSSEStream(response.body)) {
    try {
      const chunk = JSON.parse(data);
      const content = chunk.choices?.[0]?.delta?.content;
      if (content) {
        yield content;
      }
    } catch {
      // Skip malformed JSON in SSE data
    }
  }
}
