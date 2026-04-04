import type { Provider } from "../config/schema";
import type { CompletionStream, ModelInfo, ProviderClient } from "./client";
import { DEFAULT_CONTEXT_WINDOW, resolveApiKey } from "./client";

/** Builds HTTP headers for an OpenAI-compatible API request. */
function buildHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

/** Strips trailing slashes from a URL. */
function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

/** Creates a ProviderClient backed by an OpenAI-compatible API. */
export function createOpenAICompatibleClient(
  provider: Provider,
): ProviderClient {
  const apiKey = resolveApiKey(provider.type, provider.apiKey);
  const baseUrl = normalizeBaseUrl(provider.baseUrl);

  /** Fetches available models from the provider. */
  async function fetchModels(): Promise<ModelInfo[]> {
    // OpenRouter with API key uses /v1/models/user for user-enabled models only
    const modelsPath =
      provider.type === "openrouter" && apiKey
        ? "/v1/models/user"
        : "/v1/models";
    const url = `${baseUrl}${modelsPath}`;

    const response = await fetch(url, {
      headers: buildHeaders(apiKey),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Provider returned HTTP ${response.status}${body ? `: ${body}` : ""}`,
      );
    }

    const json = await response.json();
    // Handle both { data: [...] } wrapper and bare array responses
    const models: Array<Record<string, unknown>> = Array.isArray(json)
      ? json
      : ((json.data ?? []) as Array<Record<string, unknown>>);

    return models.map((m) => ({ id: String(m.id) }));
  }

  /** Fetches the context window size for a model. */
  async function fetchContextWindow(): Promise<number> {
    // TODO: implement in context window slice
    return DEFAULT_CONTEXT_WINDOW;
  }

  /** Streams a chat completion response. */
  async function streamCompletion(): Promise<CompletionStream> {
    // TODO: implement in streaming slice
    throw new Error("streamCompletion not yet implemented");
  }

  return { fetchModels, fetchContextWindow, streamCompletion };
}
