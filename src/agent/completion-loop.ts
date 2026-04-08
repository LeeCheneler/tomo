import type {
  ChatMessage as ProviderMessage,
  CompletionStream,
  ProviderClient,
  ToolDefinition,
} from "../provider/client";
import { truncateMessages } from "../context/truncate";
import { executeToolCalls } from "../tools/execute-tool-calls";
import type { ToolRegistry } from "../tools/registry";
import type { ToolContext } from "../tools/types";

/** Maximum number of nudge retries when the model returns an empty response. */
const MAX_EMPTY_RETRIES = 3;

/** Nudge message sent when the model returns an empty response. */
const EMPTY_NUDGE =
  "Your previous response was empty. Continue working on the task. If you need to use a tool, call it now. If you are done, summarize what was accomplished.";

/** Options for running a completion loop. */
export interface CompletionLoopOptions {
  /** Provider client to use for streaming completions. */
  client: ProviderClient;
  /** Model ID to request completions from. */
  model: string;
  /** Context window size for truncation. */
  contextWindow: number;
  /** System prompt prepended to every request. */
  systemPrompt: string;
  /** Initial messages (typically a single user message with the prompt). */
  initialMessages: ProviderMessage[];
  /** Tool definitions to send to the model. */
  tools?: ToolDefinition[];
  /** Registry for resolving tool calls. */
  toolRegistry: ToolRegistry;
  /** Context passed to each tool's execute function. */
  toolContext: ToolContext;
  /** Abort signal — cancels the loop when triggered. */
  signal: AbortSignal;
  /** Called with accumulated content as each token arrives (for streaming display). */
  onContent?: (content: string) => void;
}

/** Result of a completion loop run. */
export interface CompletionLoopResult {
  /** Final assistant content (may be empty if aborted or max retries exceeded). */
  content: string;
}

/**
 * Runs a self-contained completion loop: stream a response, execute any
 * tool calls, feed results back, and repeat until the model responds with
 * content only (no tool calls).
 *
 * This function is UI-agnostic — it does not depend on React or Ink.
 * Sub-agents use this as their execution engine.
 */
export async function runCompletionLoop(
  options: CompletionLoopOptions,
): Promise<CompletionLoopResult> {
  const {
    client,
    model,
    contextWindow,
    systemPrompt,
    initialMessages,
    tools,
    toolRegistry,
    toolContext,
    signal,
    onContent,
  } = options;

  const systemMessage: ProviderMessage = {
    role: "system",
    content: systemPrompt,
  };
  const currentMessages: ProviderMessage[] = [...initialMessages];
  let emptyRetries = 0;

  while (true) {
    signal.throwIfAborted();

    const allMessages = [systemMessage, ...currentMessages];
    const truncated = truncateMessages(allMessages, contextWindow);

    let stream: CompletionStream;
    try {
      stream = await client.streamCompletion({
        model,
        messages: truncated,
        tools,
        signal,
      });
    } catch (e) {
      throwIfAbort(e);
      throw e;
    }

    let content = "";
    try {
      for await (const token of stream.content) {
        signal.throwIfAborted();
        content += token;
        onContent?.(content);
      }
    } catch (e) {
      throwIfAbort(e);
      throw e;
    }

    const toolCalls = stream.getToolCalls();

    // No tool calls — check for empty response or return final content.
    if (toolCalls.length === 0) {
      if (!content.trim() && emptyRetries < MAX_EMPTY_RETRIES) {
        emptyRetries++;
        currentMessages.push({ role: "user", content: EMPTY_NUDGE });
        continue;
      }
      return { content };
    }

    // Tool calls present — execute and loop.
    emptyRetries = 0;

    // Execute tool calls. The sub-agent doesn't need dynamic UI output,
    // so no createOnProgress is passed.
    const displayMessages = await executeToolCalls(
      toolCalls,
      content,
      toolRegistry,
      toolContext,
    );

    // Build the assistant tool-call message in provider format.
    const assistantMessage: ProviderMessage = {
      role: "assistant",
      content: content || "",
      tool_calls: toolCalls,
    };
    currentMessages.push(assistantMessage);

    // Convert display tool-result messages to provider format.
    for (const msg of displayMessages) {
      if (msg.role === "tool-result") {
        currentMessages.push({
          role: "tool",
          content: msg.output,
          tool_call_id: msg.toolCallId,
        });
      }
    }
  }
}

/** Re-throws abort errors, swallows everything else. */
function throwIfAbort(e: unknown): void {
  if (e instanceof DOMException && e.name === "AbortError") {
    throw e;
  }
}
