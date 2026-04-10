import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { z } from "zod";
import type { Provider } from "../config/schema";
import type {
  CompletionStream,
  ModelInfo,
  ProviderClient,
  StreamCompletionOptions,
  TokenUsage,
  ToolCall,
} from "./client";
import { DEFAULT_CONTEXT_WINDOW, resolveApiKey } from "./client";
import { parseSSEStream } from "./sse";

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

/** Schema for a tool call delta in an SSE chunk. */
const toolCallDeltaSchema = z.object({
  index: z.number(),
  id: z.string().optional(),
  function: z
    .object({
      name: z.string().optional(),
      arguments: z.string().optional(),
    })
    .optional(),
});

/** Schema for a single choice delta in an SSE chunk. */
const deltaSchema = z.object({
  content: z.string().nullish(),
  tool_calls: z.array(toolCallDeltaSchema).optional(),
});

/** Schema for token usage in an SSE chunk. */
const usageSchema = z.object({
  prompt_tokens: z.number(),
  completion_tokens: z.number(),
});

/** Schema for an SSE streaming chunk from the completions endpoint. */
const sseChunkSchema = z.object({
  choices: z
    .array(
      z.object({
        delta: deltaSchema.optional(),
      }),
    )
    .optional(),
  usage: usageSchema.optional(),
});

/** Schema for Ollama's /api/show response model_info. */
const ollamaShowSchema = z.object({
  model_info: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Fetches the context window from Ollama's native /api/show endpoint.
 * Ollama stores context length under a key like `<arch>.context_length`
 * where the architecture prefix varies per model.
 */
async function fetchOllamaContextWindow(
  baseUrl: string,
  model: string,
): Promise<number> {
  const response = await fetch(`${baseUrl}/api/show`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
  });

  if (!response.ok) return DEFAULT_CONTEXT_WINDOW;

  const json = await response.json();
  const result = ollamaShowSchema.safeParse(json);
  if (!result.success || !result.data.model_info) return DEFAULT_CONTEXT_WINDOW;

  for (const [key, value] of Object.entries(result.data.model_info)) {
    if (key.endsWith(".context_length") && typeof value === "number") {
      return value;
    }
  }

  return DEFAULT_CONTEXT_WINDOW;
}

/**
 * Candidate fields for the context length, in priority order. Different
 * architectures use different names: Llama/Gemma/Mistral/Qwen use
 * max_position_embeddings, GPT-2 uses n_positions, some Mistral variants
 * expose only sliding_window, etc.
 */
const CONTEXT_LENGTH_FIELDS = [
  "max_position_embeddings",
  "max_sequence_length",
  "seq_length",
  "n_positions",
  "sliding_window",
] as const;

/** Loose schema for a HuggingFace config.json — we inspect specific keys by hand. */
const hfConfigSchema = z.record(z.string(), z.unknown());

/** Returns the first numeric CONTEXT_LENGTH_FIELDS value found in a config object. */
function extractContextLength(
  config: Record<string, unknown>,
): number | undefined {
  for (const field of CONTEXT_LENGTH_FIELDS) {
    const value = config[field];
    if (typeof value === "number") return value;
  }
  return undefined;
}

/** Resolves the HuggingFace hub cache directory, honouring env overrides. */
function hfHubCacheDir(): string {
  if (process.env.HF_HUB_CACHE) return process.env.HF_HUB_CACHE;
  if (process.env.HF_HOME) return join(process.env.HF_HOME, "hub");
  return join(homedir(), ".cache", "huggingface", "hub");
}

/**
 * Reads the context window from a HuggingFace model config.json on disk.
 * mlx_lm.server downloads HF models into the local cache before serving,
 * so the config is always available locally. For absolute local paths
 * (mlx_lm.server accepts these as model ids), reads config.json from the
 * model directory directly. Checks top-level first, then falls back to
 * `text_config` for multimodal models (e.g. gemma-3) that nest the text
 * model fields under that key.
 */
function fetchMlxContextWindow(modelId: string): number {
  let configPath: string;

  if (isAbsolute(modelId)) {
    configPath = join(modelId, "config.json");
  } else {
    // HF cache layout: models--<org>--<repo>/snapshots/<hash>/config.json
    const repoDir = join(
      hfHubCacheDir(),
      `models--${modelId.replace(/\//g, "--")}`,
      "snapshots",
    );
    if (!existsSync(repoDir)) return DEFAULT_CONTEXT_WINDOW;
    const snapshots = readdirSync(repoDir);
    if (snapshots.length === 0) return DEFAULT_CONTEXT_WINDOW;
    configPath = join(repoDir, snapshots[0], "config.json");
  }

  if (!existsSync(configPath)) return DEFAULT_CONTEXT_WINDOW;

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(configPath, "utf-8"));
  } catch {
    return DEFAULT_CONTEXT_WINDOW;
  }

  const result = hfConfigSchema.safeParse(parsed);
  if (!result.success) return DEFAULT_CONTEXT_WINDOW;

  const topLevel = extractContextLength(result.data);
  if (topLevel !== undefined) return topLevel;

  const textConfig = hfConfigSchema.safeParse(result.data.text_config);
  if (textConfig.success) {
    const nested = extractContextLength(textConfig.data);
    if (nested !== undefined) return nested;
  }

  return DEFAULT_CONTEXT_WINDOW;
}

/** Schema for a model entry with optional context_length. */
const modelEntrySchema = z.object({
  id: z.string(),
  context_length: z.number().optional(),
});

/** Schema for the /v1/models response — wrapped or bare array. */
const modelsResponseSchema = z.union([
  z.object({ data: z.array(modelEntrySchema) }),
  z.array(modelEntrySchema),
]);

/**
 * Fetches the context window from /v1/models metadata.
 * Works for providers that include context_length in their model entries
 * (OpenRouter, OpenCode Zen).
 */
async function fetchModelsContextWindow(
  baseUrl: string,
  model: string,
  apiKey?: string,
): Promise<number> {
  const response = await fetch(`${baseUrl}/v1/models`, {
    headers: buildHeaders(apiKey),
  });

  if (!response.ok) return DEFAULT_CONTEXT_WINDOW;

  const json = await response.json();
  const result = modelsResponseSchema.safeParse(json);
  if (!result.success) return DEFAULT_CONTEXT_WINDOW;

  const models = Array.isArray(result.data) ? result.data : result.data.data;
  const entry = models.find((m) => m.id === model);

  return entry?.context_length ?? DEFAULT_CONTEXT_WINDOW;
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

  /**
   * Fetches the context window size for a model.
   * Ollama exposes this via its native /api/show endpoint. OpenRouter and
   * OpenCode Zen include context_length in the /v1/models metadata. MLX
   * doesn't expose it over HTTP at all, so we read max_position_embeddings
   * from the HuggingFace cache on disk. Falls back to DEFAULT_CONTEXT_WINDOW
   * if detection fails.
   */
  async function fetchContextWindow(model: string): Promise<number> {
    try {
      if (provider.type === "ollama") {
        return await fetchOllamaContextWindow(baseUrl, model);
      }
      if (provider.type === "mlx") {
        return fetchMlxContextWindow(model);
      }
      return await fetchModelsContextWindow(baseUrl, model, apiKey);
    } catch {
      return DEFAULT_CONTEXT_WINDOW;
    }
  }

  /**
   * Streams a chat completion response from the OpenAI-compatible endpoint.
   *
   * Sends a POST to /v1/chat/completions with stream: true and parses the
   * response as Server-Sent Events (SSE). Returns a CompletionStream with:
   * - content: an async iterable that yields text tokens as they arrive
   * - getUsage(): token counts, available after the stream is fully consumed
   * - getToolCalls(): accumulated tool calls, available after the stream is fully consumed
   *
   * The SSE stream consists of JSON chunks, each containing a delta with partial
   * content, tool call fragments, or token usage. Content deltas are yielded
   * immediately. Tool calls are accumulated across multiple chunks since the
   * provider splits them: the first chunk carries the id and function name,
   * subsequent chunks append to the arguments string. Usage arrives in the
   * final chunk before [DONE].
   */
  async function streamCompletion(
    options: StreamCompletionOptions,
  ): Promise<CompletionStream> {
    const url = `${baseUrl}/v1/chat/completions`;

    // stream_options.include_usage asks the provider to send a final chunk
    // with prompt and completion token counts before closing the stream.
    const response = await fetch(url, {
      method: "POST",
      headers: buildHeaders(apiKey),
      body: JSON.stringify({
        model: options.model,
        messages: options.messages,
        stream: true,
        stream_options: { include_usage: true },
        ...(options.maxTokens != null && { max_tokens: options.maxTokens }),
        ...(options.tools &&
          options.tools.length > 0 && { tools: options.tools }),
      }),
      signal: options.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Provider returned HTTP ${response.status}${body ? `: ${body}` : ""}`,
      );
    }

    if (!response.body) {
      throw new Error("Provider returned an empty response body");
    }

    const responseBody = response.body;

    // Usage and tool calls are populated as side effects while iterating
    // the content generator below. They're only complete after the stream
    // is fully consumed, which is why they're accessed via closures.
    let usage: TokenUsage | null = null;
    const toolCalls: ToolCall[] = [];

    /**
     * Async generator that parses SSE data lines into typed chunks and
     * yields content tokens. Malformed JSON and chunks that don't match
     * the expected schema are silently skipped.
     */
    async function* streamContent(): AsyncGenerator<string> {
      for await (const data of parseSSEStream(responseBody)) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(data);
        } catch {
          // Skip lines that aren't valid JSON (e.g. comments, keepalives)
          continue;
        }
        const result = sseChunkSchema.safeParse(parsed);
        if (!result.success) continue;

        const chunk = result.data;
        const delta = chunk.choices?.[0]?.delta;

        // Yield text content as it arrives for real-time rendering
        if (delta?.content) {
          yield delta.content;
        }

        // Tool calls arrive fragmented across multiple SSE chunks.
        // The first chunk for a given index carries the id and function name;
        // subsequent chunks for the same index append to the arguments string.
        // We use the index to track which tool call each fragment belongs to.
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (!toolCalls[tc.index]) {
              // First fragment for this tool call — initialise with defaults
              toolCalls[tc.index] = {
                id: tc.id ?? "",
                type: "function",
                function: {
                  name: tc.function?.name ?? "",
                  arguments: tc.function?.arguments ?? "",
                },
              };
            } else {
              // Subsequent fragment — merge into the existing tool call
              const existing = toolCalls[tc.index];
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.function.name = tc.function.name;
              if (tc.function?.arguments) {
                existing.function.arguments += tc.function.arguments;
              }
            }
          }
        }

        // The provider sends usage in the final chunk when stream_options.include_usage is set
        if (chunk.usage) {
          usage = {
            promptTokens: chunk.usage.prompt_tokens,
            completionTokens: chunk.usage.completion_tokens,
          };
        }
      }
    }

    return {
      content: streamContent(),
      getUsage: () => usage,
      getToolCalls: () => toolCalls,
    };
  }

  return { fetchModels, fetchContextWindow, streamCompletion };
}
