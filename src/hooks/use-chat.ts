import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import chalk from "chalk";
import { getCommand, parse } from "../commands";
import type { DisplayMessage } from "../components/message-list";
import {
  type Config,
  type ProviderConfig,
  getMaxTokens,
  getProviderByName,
  updateActiveModel,
  updateActiveProvider,
} from "../config";
import { truncateMessages } from "../context/truncate";
import type { ChatMessage, TokenUsage, ToolCall } from "../provider/client";
import {
  fetchContextWindow,
  getDefaultContextWindow,
  streamChatCompletion,
} from "../provider/client";
import {
  type Session,
  appendMessage,
  createSession,
  loadSession,
} from "../session";
import { type ToolContext, getTool, getToolDefinitions } from "../tools";

export interface ChatState {
  messages: DisplayMessage[];
  streaming: boolean;
  streamingContent: string;
  error: string | null;
  activeCommand: ReactElement | null;
  activeModel: string;
  activeProvider: ProviderConfig;
  tokenUsage: TokenUsage | null;
  contextWindow: number;
  pendingMessage: string | null;
  toolOutputExpanded: boolean;
  toolActive: boolean;
  toggleToolOutput: () => void;
  submit: (text: string) => void;
  cancel: () => void;
}

class ToolDismissedError extends Error {
  constructor() {
    super("The user dismissed the question.");
  }
}

/** Executes tool calls and returns tool result messages. */
const MAX_ARG_VALUE_LENGTH = 60;

/** Truncates a string to a max length with ellipsis. */
function truncateValue(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

/** Formats a single arg value for display. */
function formatArgValue(value: unknown): string {
  if (typeof value === "string") {
    return truncateValue(value, MAX_ARG_VALUE_LENGTH);
  }
  if (Array.isArray(value)) {
    return `[${value.length} items]`;
  }
  return truncateValue(JSON.stringify(value), MAX_ARG_VALUE_LENGTH);
}

/** Formats a tool call header: bold yellow name + dim args summary. */
function formatToolHeader(name: string, args: string): string {
  let argsSummary = "";
  try {
    const parsed = JSON.parse(args);
    argsSummary = Object.entries(parsed)
      .map(([k, v]) => `${k}: ${formatArgValue(v)}`)
      .join(", ");
  } catch {
    // Malformed args — skip summary
  }
  const header = argsSummary
    ? `${chalk.bold.yellow(name)}  ${chalk.dim(argsSummary)}`
    : chalk.bold.yellow(name);
  return header;
}

/** Execute a single tool call and return a tool result message. */
async function executeSingleToolCall(
  tc: ToolCall,
  toolContext: ToolContext,
): Promise<DisplayMessage> {
  const tool = getTool(tc.function.name);
  let result: string;
  if (!tool) {
    result = `Error: unknown tool "${tc.function.name}"`;
  } else {
    try {
      result = await tool.execute(tc.function.arguments, toolContext);
    } catch (err) {
      if (err instanceof ToolDismissedError) throw err;
      result = `Error: ${err instanceof Error ? err.message : String(err)}`;
    }
  }

  const header = formatToolHeader(tc.function.name, tc.function.arguments);
  return {
    id: crypto.randomUUID(),
    role: "tool",
    content: `${header}\n${result}`,
    tool_call_id: tc.id,
  };
}

/** Executes tool calls. Non-interactive tools run in parallel, interactive ones run sequentially. */
async function executeToolCalls(
  toolCalls: ToolCall[],
  signal: AbortSignal,
  toolContext: ToolContext,
): Promise<DisplayMessage[]> {
  // Separate into non-interactive (can run in parallel) and interactive (must be sequential).
  const nonInteractive: ToolCall[] = [];
  const interactive: ToolCall[] = [];

  for (const tc of toolCalls) {
    const tool = getTool(tc.function.name);
    if (tool && tool.interactive === false) {
      nonInteractive.push(tc);
    } else {
      interactive.push(tc);
    }
  }

  // Run non-interactive tools in parallel.
  const parallelResults =
    nonInteractive.length > 0
      ? await Promise.all(
          nonInteractive.map((tc) => executeSingleToolCall(tc, toolContext)),
        )
      : [];

  // Run interactive tools sequentially.
  const sequentialResults: DisplayMessage[] = [];
  for (const tc of interactive) {
    if (signal.aborted) {
      throw new DOMException("aborted", "AbortError");
    }
    sequentialResults.push(await executeSingleToolCall(tc, toolContext));
  }

  // Return results in the original tool call order.
  const allResults = [...parallelResults, ...sequentialResults];
  const resultByCallId = new Map<string, DisplayMessage>();
  for (const msg of allResults) {
    if (msg.role === "tool") {
      resultByCallId.set(msg.tool_call_id, msg);
    }
  }
  return toolCalls.map((tc) => resultByCallId.get(tc.id) as DisplayMessage);
}

/** Manages conversation state and streaming for a chat session. */
export function useChat(
  config: Config,
  initialProvider: ProviderConfig,
  initialModel: string,
  initialSession: Session,
  systemMessage: string | null = null,
): ChatState {
  const [messages, setMessages] = useState<DisplayMessage[]>(
    initialSession.messages,
  );
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeCommand, setActiveCommand] = useState<ReactElement | null>(null);
  const [activeModel, setActiveModel] = useState(initialModel);
  const [activeProvider, setActiveProviderState] =
    useState<ProviderConfig>(initialProvider);
  const [tokenUsage, setTokenUsage] = useState<TokenUsage | null>(null);
  const [contextWindow, setContextWindow] = useState(
    initialProvider.contextWindow ?? getDefaultContextWindow(),
  );
  const [toolOutputExpanded, setToolOutputExpanded] = useState(false);
  const [toolActive, setToolActive] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef<Session>(initialSession);
  const streamingRef = useRef(false);
  const pendingMessageRef = useRef<string | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  // Detect context window from provider when model or provider changes.
  // Config override takes precedence — only fetch if no override is set.
  useEffect(() => {
    if (activeProvider.contextWindow) {
      setContextWindow(activeProvider.contextWindow);
      return;
    }
    let cancelled = false;
    fetchContextWindow(
      activeProvider.baseUrl,
      activeModel,
      activeProvider.type,
    ).then((size) => {
      if (!cancelled) setContextWindow(size);
    });
    return () => {
      cancelled = true;
    };
  }, [
    activeProvider.baseUrl,
    activeProvider.contextWindow,
    activeProvider.type,
    activeModel,
  ]);

  const addMessages = (...msgs: DisplayMessage[]) => {
    setMessages((prev) => [...prev, ...msgs]);
  };

  const clearMessages = () => {
    const newSession = createSession(activeProvider.name, activeModel);
    sessionRef.current = newSession;

    pendingMessageRef.current = null;
    setPendingMessage(null);
    abortRef.current?.abort();
    setMessages([]);
    setStreaming(false);
    setStreamingContent("");
    setError(null);
    setActiveCommand(null);
    abortRef.current = null;
  };

  const submit = async (text: string) => {
    if (streamingRef.current) {
      pendingMessageRef.current = text;
      setPendingMessage(text);
      return;
    }

    const parsed = parse(text);

    if (parsed) {
      const userMsg: DisplayMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
      };

      const command = getCommand(parsed.name);
      if (!command) {
        addMessages(userMsg, {
          id: crypto.randomUUID(),
          role: "system",
          content: `Unknown command: /${parsed.name}. Type /help for available commands.`,
        });
        return;
      }

      const result = await command.execute(parsed.args, {
        onComplete: (completionResult) => {
          addMessages({
            id: crypto.randomUUID(),
            role: "system",
            content: completionResult.output,
          });
          setActiveCommand(null);
        },
        onCancel: () => {
          setActiveCommand(null);
        },
        clearMessages,
        switchSession: (id: string) => {
          const session = loadSession(id);
          if (!session) return `Session not found: ${id}`;
          sessionRef.current = session;
          setMessages(session.messages);
          return null;
        },
        setActiveModel: (model: string) => {
          setActiveModel(model);
          updateActiveModel(model);
        },
        setActiveProvider: (name: string) => {
          const provider = getProviderByName(config, name);
          if (!provider) {
            const available = config.providers.map((p) => p.name).join(", ");
            return `Unknown provider: ${name}. Available: ${available}`;
          }
          setActiveProviderState(provider);
          updateActiveProvider(name);
          return null;
        },
        providerBaseUrl: activeProvider.baseUrl,
        activeModel,
        activeProvider: activeProvider.name,
        providerNames: config.providers.map((p) => p.name),
        contextWindow,
        maxTokens: getMaxTokens(config, activeProvider, activeModel),
        tokenUsage,
        messageCount: messages.length,
      });

      if ("interactive" in result) {
        addMessages(userMsg);
        setActiveCommand(result.interactive);
      } else {
        addMessages(userMsg, {
          id: crypto.randomUUID(),
          role: "system",
          content: result.output,
        });
      }
      return;
    }

    const userMsg: DisplayMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMsg]);
    appendMessage(sessionRef.current, userMsg);
    streamingRef.current = true;
    setStreaming(true);
    setStreamingContent("");
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    const toChatMessages = (
      displayMessages: DisplayMessage[],
    ): ChatMessage[] => [
      ...(systemMessage
        ? [{ role: "system" as const, content: systemMessage }]
        : []),
      ...displayMessages
        .filter((m) => m.role !== "system")
        .map((m): ChatMessage => {
          if (m.role === "tool") {
            return {
              role: "tool",
              content: m.content,
              tool_call_id: m.tool_call_id,
            };
          }
          if (m.role === "assistant" && m.tool_calls) {
            return {
              role: "assistant",
              content: m.content,
              tool_calls: m.tool_calls,
            };
          }
          return { role: m.role as "user" | "assistant", content: m.content };
        }),
    ];

    // Track the full message list across tool-call iterations so each
    // re-call to the provider includes prior tool results.
    let currentMessages: DisplayMessage[] = [...messages, userMsg];

    const maxTokens = getMaxTokens(config, activeProvider, activeModel);
    const toolDefs = getToolDefinitions();

    const toolContext: ToolContext = {
      renderInteractive: (factory) =>
        new Promise<string>((resolve, reject) => {
          const onResult = (result: string) => {
            setActiveCommand(null);
            resolve(result);
          };
          const onCancel = () => {
            setActiveCommand(null);
            reject(new ToolDismissedError());
          };
          setActiveCommand(factory(onResult, onCancel));
        }),
      reportProgress: (progressContent: string) => {
        setStreamingContent(progressContent);
      },
    };

    let aborted = false;
    // Declared outside the loop so partial content survives abort.
    let content = "";

    try {
      // Tool loop: stream a completion, check for tool calls, execute
      // them, and re-call the provider until the model responds with
      // content only (no more tool calls).
      while (true) {
        content = "";

        const chatMessages = truncateMessages(
          toChatMessages(currentMessages),
          contextWindow,
          maxTokens,
          tokenUsage?.promptTokens ?? null,
        );

        const completion = await streamChatCompletion({
          baseUrl: activeProvider.baseUrl,
          model: activeModel,
          messages: chatMessages,
          maxTokens,
          signal: controller.signal,
          ...(toolDefs.length > 0 && { tools: toolDefs }),
        });

        for await (const token of completion.content) {
          content += token;
          setStreamingContent(content);
        }

        const usage = completion.getUsage();
        if (usage) {
          setTokenUsage(usage);
        }

        const toolCalls = completion.getToolCalls();

        if (toolCalls.length === 0) {
          // No tool calls — add assistant content message and finish.
          if (content) {
            const assistantMsg: DisplayMessage = {
              id: crypto.randomUUID(),
              role: "assistant",
              content,
            };
            currentMessages = [...currentMessages, assistantMsg];
            setMessages(currentMessages);
            appendMessage(sessionRef.current, assistantMsg);
          }
          break;
        }

        // Assistant responded with tool calls — persist the assistant
        // message (with tool_calls), execute each tool, and append
        // tool result messages before re-calling the provider.
        const assistantMsg: DisplayMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: content || "",
          tool_calls: toolCalls,
        };
        currentMessages = [...currentMessages, assistantMsg];
        appendMessage(sessionRef.current, assistantMsg);

        let toolResultMessages: DisplayMessage[];
        setToolActive(true);
        try {
          toolResultMessages = await executeToolCalls(
            toolCalls,
            controller.signal,
            toolContext,
          );
        } catch (err) {
          setToolActive(false);
          if (err instanceof ToolDismissedError) {
            // User dismissed a tool interaction — add a system note and
            // stop the turn without calling the provider again.
            const dismissedMsg: DisplayMessage = {
              id: crypto.randomUUID(),
              role: "system",
              content: "Question dismissed",
            };
            currentMessages = [...currentMessages, dismissedMsg];
            setMessages(currentMessages);
            break;
          }
          throw err;
        }
        setToolActive(false);

        for (const msg of toolResultMessages) {
          currentMessages = [...currentMessages, msg];
          appendMessage(sessionRef.current, msg);
        }

        setMessages(currentMessages);
        setStreamingContent("");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        aborted = true;
        // User cancelled — keep what we have. Persist partial content
        // if the stream had yielded anything.
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    // On abort, preserve partial content and sync accumulated messages.
    if (aborted && content) {
      const partialMsg: DisplayMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content,
      };
      currentMessages = [...currentMessages, partialMsg];
      appendMessage(sessionRef.current, partialMsg);
    }
    if (aborted) {
      setMessages(currentMessages);
    }

    streamingRef.current = false;
    setStreaming(false);
    setStreamingContent("");
    abortRef.current = null;
  };

  // Keep a ref to the latest submit so the pending-message effect
  // always calls the version with up-to-date message history.
  const submitRef = useRef(submit);
  submitRef.current = submit;

  // Process queued message after streaming completes.
  useEffect(() => {
    if (!streaming && pendingMessageRef.current !== null) {
      const pending = pendingMessageRef.current;
      pendingMessageRef.current = null;
      setPendingMessage(null);
      submitRef.current(pending);
    }
  }, [streaming]);

  const cancel = () => {
    pendingMessageRef.current = null;
    setPendingMessage(null);
    abortRef.current?.abort();
  };

  const toggleToolOutput = () => {
    setToolOutputExpanded((prev) => !prev);
  };

  return {
    messages,
    streaming,
    streamingContent,
    error,
    activeCommand,
    activeModel,
    activeProvider,
    tokenUsage,
    contextWindow,
    pendingMessage,
    toolOutputExpanded,
    toolActive,
    toggleToolOutput,
    submit,
    cancel,
  };
}
