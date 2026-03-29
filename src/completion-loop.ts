import type { DisplayMessage } from "./components/message-list";
import { truncateMessages } from "./context/truncate";
import { executeToolCalls, ToolDismissedError } from "./hooks/tool-execution";
import { stripAnsi } from "./strip-ansi";
import type { McpManager } from "./mcp/manager";
import type {
  ChatMessage,
  TokenUsage,
  ToolDefinition,
} from "./provider/client";
import { streamChatCompletion } from "./provider/client";
import type { ToolContext } from "./tools";

export interface CompletionLoopOptions {
  baseUrl: string;
  model: string;
  apiKey?: string;
  systemMessage: string | null;
  initialMessages: ChatMessage[];
  tools?: ToolDefinition[];
  toolContext: ToolContext;
  maxTokens: number;
  contextWindow: number;
  lastPromptTokens?: number | null;
  signal: AbortSignal;
  /** Called with accumulated content as each token arrives. */
  onContent?: (content: string) => void;
  /** Called when a new message is added to the history. */
  onMessage?: (message: ChatMessage) => void;
  /** Called when tool execution starts or stops. */
  onToolActive?: (active: boolean) => void;
  /** Called when token usage is reported by the provider. */
  onUsage?: (usage: TokenUsage) => void;
  /** MCP manager for routing MCP tool calls. */
  mcpManager?: McpManager;
  /** Tool availability map for checking disabled tools at execution time. */
  toolAvailability?: Record<string, boolean>;
}

export interface CompletionLoopResult {
  /** Final assistant content (or partial content if aborted). */
  content: string;
  /** Full message history including all new messages from this loop. */
  messages: ChatMessage[];
  /** Whether the loop was aborted via the signal. */
  aborted: boolean;
}

const MAX_EMPTY_RETRIES = 3;

/**
 * Runs the completion loop: stream a response, execute any tool calls,
 * and repeat until the model responds with content only.
 *
 * This function is UI-agnostic — callers wire side effects via callbacks.
 */
export async function runCompletionLoop(
  options: CompletionLoopOptions,
): Promise<CompletionLoopResult> {
  const {
    baseUrl,
    model,
    apiKey,
    systemMessage,
    initialMessages,
    tools,
    toolContext,
    maxTokens,
    contextWindow,
    signal,
    onContent,
    onMessage,
    onToolActive,
    onUsage,
    mcpManager,
    toolAvailability,
  } = options;

  let currentMessages = [...initialMessages];
  let lastPromptTokens = options.lastPromptTokens ?? null;
  let aborted = false;
  let content = "";
  let emptyResponseRetries = 0;
  let nudgeMessage: ChatMessage | null = null;

  const systemMessages: ChatMessage[] = systemMessage
    ? [{ role: "system", content: systemMessage }]
    : [];

  function addMessage(msg: ChatMessage) {
    currentMessages = [...currentMessages, msg];
    onMessage?.(msg);
  }

  try {
    while (true) {
      content = "";

      const chatMessages = truncateMessages(
        [...systemMessages, ...currentMessages],
        contextWindow,
        maxTokens,
        lastPromptTokens,
      );

      if (nudgeMessage) {
        chatMessages.push(nudgeMessage);
        nudgeMessage = null;
      }

      const completion = await streamChatCompletion({
        baseUrl,
        model,
        messages: chatMessages,
        maxTokens,
        signal,
        ...(tools && tools.length > 0 && { tools }),
        ...(apiKey && { apiKey }),
      });

      for await (const token of completion.content) {
        content += token;
        onContent?.(content);
      }

      const usage = completion.getUsage();
      if (usage) {
        lastPromptTokens = usage.promptTokens;
        onUsage?.(usage);
      }

      const toolCalls = completion.getToolCalls();

      if (toolCalls.length === 0) {
        if (!content.trim() && emptyResponseRetries < MAX_EMPTY_RETRIES) {
          emptyResponseRetries++;
          nudgeMessage = {
            role: "user",
            content:
              "Your previous response was empty. Continue working on the task. If you need to use a tool, call it now. If you are done, summarize what was accomplished.",
          };
          continue;
        }

        if (content) {
          const assistantMsg: ChatMessage = {
            role: "assistant",
            content,
          };
          addMessage(assistantMsg);
        }
        break;
      }

      emptyResponseRetries = 0;

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: content || "",
        tool_calls: toolCalls,
      };
      addMessage(assistantMsg);

      onToolActive?.(true);
      let toolResultDisplayMessages: DisplayMessage[];
      try {
        toolResultDisplayMessages = await executeToolCalls(
          toolCalls,
          signal,
          toolContext,
          mcpManager,
          toolAvailability,
        );
      } catch (err) {
        onToolActive?.(false);
        if (err instanceof ToolDismissedError) {
          const dismissedMsg: ChatMessage = {
            role: "system",
            content: "Question dismissed",
          };
          addMessage(dismissedMsg);
          break;
        }
        throw err;
      }
      onToolActive?.(false);

      for (const dm of toolResultDisplayMessages) {
        if (dm.role !== "tool") continue;
        const toolMsg: ChatMessage = {
          role: "tool",
          content: stripAnsi(dm.content),
          tool_call_id: dm.tool_call_id,
        };
        addMessage(toolMsg);
      }

      onContent?.("");
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      aborted = true;
    } else {
      throw err;
    }
  }

  if (aborted && content) {
    const partialMsg: ChatMessage = {
      role: "assistant",
      content,
    };
    addMessage(partialMsg);
  }

  return { content, messages: currentMessages, aborted };
}
