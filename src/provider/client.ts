import type { ProviderType } from "../config/schema";
import { env } from "../utils/env";

/** A model available from the provider. */
export interface ModelInfo {
  id: string;
}

/** Token usage from a completion response. */
export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
}

/** A text content part in a multimodal message. */
export interface TextContentPart {
  type: "text";
  text: string;
}

/** An image content part in a multimodal message. */
export interface ImageContentPart {
  type: "image_url";
  image_url: { url: string };
}

/** A content part in a multimodal message. */
export type ContentPart = TextContentPart | ImageContentPart;

/** A tool call requested by the assistant. */
export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/** A tool definition for function calling. */
export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

/** A chat message in the OpenAI-compatible format. */
export type ChatMessage =
  | { role: "user"; content: string | ContentPart[] }
  | { role: "system"; content: string }
  | { role: "assistant"; content: string; tool_calls?: ToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string };

/** Options for a streaming completion request. */
export interface StreamCompletionOptions {
  model: string;
  messages: ChatMessage[];
  maxTokens?: number;
  signal?: AbortSignal;
  tools?: ToolDefinition[];
}

/** A streaming completion response. */
export interface CompletionStream {
  /** Async iterable of content token strings. */
  content: AsyncIterable<string>;
  /** Returns token usage after the stream has been fully consumed. */
  getUsage: () => TokenUsage | null;
  /** Returns accumulated tool calls after the stream has been fully consumed. */
  getToolCalls: () => ToolCall[];
}

/** Client interface for communicating with an LLM provider. */
export interface ProviderClient {
  /** Fetches the list of available models from the provider. */
  fetchModels(): Promise<ModelInfo[]>;
  /** Fetches the context window size for a specific model. */
  fetchContextWindow(model: string): Promise<number>;
  /** Streams a chat completion response. */
  streamCompletion(options: StreamCompletionOptions): Promise<CompletionStream>;
}

/** Default base URLs for each provider type. */
export const PROVIDER_DEFAULT_URLS: Record<ProviderType, string> = {
  ollama: "http://localhost:11434",
  "opencode-zen": "https://opencode.ai/zen",
  openrouter: "https://openrouter.ai/api",
};

/** Environment variable names for provider API keys. */
export const API_KEY_ENV_VARS: Record<ProviderType, string> = {
  ollama: "OLLAMA_API_KEY",
  "opencode-zen": "OPENCODE_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
};

/**
 * Resolves the API key for a provider.
 * Uses the config apiKey if set, otherwise falls back to a conventional env var.
 */
export function resolveApiKey(
  providerType: ProviderType,
  configApiKey?: string,
): string | undefined {
  if (configApiKey) return configApiKey;
  const envVar = API_KEY_ENV_VARS[providerType];
  return env.getOptional(envVar);
}

/** Default context window size when detection fails. */
export const DEFAULT_CONTEXT_WINDOW = 8192;
