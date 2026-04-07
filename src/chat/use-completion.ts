import { useCallback, useRef, useState } from "react";
import type { Provider } from "../config/schema";
import { truncateMessages } from "../context/truncate";
import type {
  ChatMessage,
  TokenUsage,
  ToolCall,
  ToolDefinition,
} from "../provider/client";
import { createOpenAICompatibleClient } from "../provider/openai-compatible";

/** Completion state machine states. */
type CompletionState = "idle" | "streaming" | "complete" | "aborted" | "error";

/** Options for a send() call. */
export interface SendOptions {
  messages: ChatMessage[];
  tools?: ToolDefinition[];
}

/** Return value of useCompletion. */
export interface UseCompletionResult {
  /** Current state of the completion lifecycle. */
  state: CompletionState;
  /** Accumulated content from the stream. Grows as tokens arrive. */
  content: string;
  /** Error message if state is "error", null otherwise. */
  error: string | null;
  /** Token usage, available after the stream completes. */
  usage: TokenUsage | null;
  /** Tool calls from the completed stream, empty if none. */
  toolCalls: ToolCall[];
  /** Starts a streaming completion request. Only call when not already streaming. */
  send: (options: SendOptions) => void;
  /** Aborts the in-flight stream. Keeps partial content and sets state to "complete". */
  abort: () => void;
}

/**
 * Manages a streaming chat completion lifecycle.
 *
 * Creates a provider client from the given config and streams completions
 * token by token. The caller provides messages via send() and reads
 * accumulated content, usage, and error state from the return value.
 *
 * Returns idle state if provider or model is null (not configured).
 */
export function useCompletion(
  provider: Provider | null,
  model: string | null,
  contextWindow: number,
): UseCompletionResult {
  const [state, setState] = useState<CompletionState>("idle");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<TokenUsage | null>(null);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const contextWindowRef = useRef(contextWindow);
  contextWindowRef.current = contextWindow;

  /** Starts a streaming completion request. */
  const send = useCallback(
    (options: SendOptions) => {
      if (!provider || !model) return;

      // Reset state for new request. Usage is preserved so /context still
      // reports the last known value when a stream is aborted before the
      // final chunk (which carries usage data).
      setState("streaming");
      setContent("");
      setError(null);
      setToolCalls([]);

      const messages = truncateMessages(
        options.messages,
        contextWindowRef.current,
      );

      const controller = new AbortController();
      abortRef.current = controller;

      const client = createOpenAICompatibleClient(provider);

      client
        .streamCompletion({
          model,
          messages,
          signal: controller.signal,
          tools: options.tools,
        })
        .then(async (stream) => {
          let accumulated = "";
          for await (const token of stream.content) {
            /* v8 ignore next -- race condition guard between token yields */
            if (controller.signal.aborted) return;
            accumulated += token;
            setContent(accumulated);
          }

          if (controller.signal.aborted) return;
          const newUsage = stream.getUsage();
          if (newUsage) setUsage(newUsage);
          setToolCalls(stream.getToolCalls());
          setState("complete");
        })
        .catch((err: Error) => {
          // Abort errors are expected when the user cancels — not an error state
          /* v8 ignore next -- abort errors are swallowed, tested via abort test */
          if (controller.signal.aborted) return;
          setError(err.message);
          setState("error");
        });
    },
    [provider, model],
  );

  /** Aborts the in-flight stream and keeps partial content. */
  const abort = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setState("aborted");
  }, []);

  return { state, content, error, usage, toolCalls, send, abort };
}
