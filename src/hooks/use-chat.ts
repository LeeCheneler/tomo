import chalk from "chalk";
import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import { getCommand, parse } from "../commands";
import { runCompletionLoop } from "../completion-loop";
import type { DisplayMessage } from "../components/message-list";
import {
  type Config,
  getAllMcpServers,
  getAllowedCommands,
  getMaxTokens,
  getMcpServers,
  getProviderByName,
  loadConfig,
  type ProviderConfig,
  updateActiveModel,
  updateActiveProvider,
} from "../config";
import { getErrorMessage } from "../errors";
import type { ImageAttachment } from "../images";
import { encodeToolName, McpManager } from "../mcp/manager";
import { resolvePermissions } from "../permissions";
import type { ChatMessage, ContentPart, TokenUsage } from "../provider/client";
import {
  fetchContextWindow,
  getDefaultContextWindow,
  resolveApiKey,
} from "../provider/client";
import {
  appendMessage,
  createSession,
  loadSession,
  removeLastMessage,
  type Session,
} from "../session";
import { getSkill } from "../skills";
import {
  getToolDefinitions,
  resolveToolAvailability,
  type ToolContext,
} from "../tools";
import { ToolDismissedError } from "./tool-execution";

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
  toolActive: boolean;
  inputHistory: string[];
  mcpWarnings: string[];
  submit: (text: string, clipboardImages?: ImageAttachment[]) => void;
  cancel: () => void;
  cancelPending: () => void;
  clearMessages: () => void;
}

/** Converts DisplayMessages to ChatMessages for the provider API. */
function toChatMessages(
  displayMessages: DisplayMessage[],
  systemMessage: string | null,
): ChatMessage[] {
  return [
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
        if (m.role === "user" && m.images && m.images.length > 0) {
          const parts: ContentPart[] = [
            { type: "text", text: m.content },
            ...m.images.map(
              (img): ContentPart => ({
                type: "image_url",
                image_url: { url: img.dataUri },
              }),
            ),
          ];
          return { role: "user", content: parts };
        }
        return { role: m.role as "user" | "assistant", content: m.content };
      }),
  ];
}

/** Parse skill invocation (//skill-name [args]) from user input. */
function parseSkillInvocation(
  text: string,
):
  | { chatText: string; skillDisplay: DisplayMessage | null }
  | { error: DisplayMessage } {
  if (!text.startsWith("//")) {
    return { chatText: text, skillDisplay: null };
  }

  const rest = text.slice(2);
  const spaceIndex = rest.indexOf(" ");
  const skillName = spaceIndex === -1 ? rest : rest.slice(0, spaceIndex);
  const skillArgs = spaceIndex === -1 ? "" : rest.slice(spaceIndex + 1).trim();
  const skill = getSkill(skillName);

  if (!skill) {
    return {
      error: {
        id: crypto.randomUUID(),
        role: "system",
        content: `Unknown skill: //${skillName}. Type /skills for available skills.`,
      },
    };
  }

  const chatText = skillArgs ? `${skill.body}\n\n${skillArgs}` : skill.body;
  const skillDisplay: DisplayMessage = {
    id: crypto.randomUUID(),
    role: "system",
    content: skillArgs
      ? `${chalk.bold.yellow(`skill(${skillName})`)}  ${chalk.dim(skillArgs)}`
      : chalk.bold.yellow(`skill(${skillName})`),
  };

  return { chatText, skillDisplay };
}

/** Build the tool context passed to tool execute handlers. */
function buildToolContext(opts: {
  setActiveCommand: (el: ReactElement | null) => void;
  setStreamingContent: (content: string) => void;
  permissions: Record<string, boolean>;
  signal: AbortSignal;
  providerConfig: ToolContext["providerConfig"];
  allowedCommands: string[];
}): ToolContext {
  return {
    renderInteractive: (factory) =>
      new Promise<string>((resolve, reject) => {
        const onResult = (result: string) => {
          opts.setActiveCommand(null);
          resolve(result);
        };
        const onCancel = () => {
          opts.setActiveCommand(null);
          reject(new ToolDismissedError());
        };
        opts.setActiveCommand(factory(onResult, onCancel));
      }),
    reportProgress: (progressContent: string) => {
      opts.setStreamingContent(progressContent);
    },
    permissions: opts.permissions,
    signal: opts.signal,
    depth: 0,
    providerConfig: opts.providerConfig,
    allowedCommands: opts.allowedCommands,
  };
}

/** Manages conversation state and streaming for a chat session. */
export function useChat(
  config: Config,
  initialProvider: ProviderConfig,
  initialModel: string,
  initialSession: Session,
  systemMessage: string | null = null,
  onRestart?: () => void,
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
  const [providers, setProviders] = useState(config.providers);
  const [toolActive, setToolActive] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef<Session>(initialSession);
  const streamingRef = useRef(false);
  const pendingMessageRef = useRef<string | null>(null);
  const mcpManagerRef = useRef<McpManager | null>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const inputHistoryRef = useRef<string[]>([]);
  const [mcpWarnings, setMcpWarnings] = useState<string[]>([]);

  // Start MCP servers on mount, shut down on unmount.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only run once on mount
  useEffect(() => {
    let cancelled = false;
    const mcpServers = getMcpServers(config);
    const serverNames = Object.keys(mcpServers);
    if (serverNames.length > 0) {
      const manager = new McpManager();
      manager.startAll(mcpServers).then((failures) => {
        if (cancelled) {
          manager.shutdown();
          return;
        }
        mcpManagerRef.current = manager;
        if (failures.length > 0) {
          setMcpWarnings(
            failures.map((name) => `MCP server "${name}": failed to connect`),
          );
        }
      });
    }
    return () => {
      cancelled = true;
      mcpManagerRef.current?.shutdown();
      mcpManagerRef.current = null;
    };
  }, []);

  // Detect context window from provider when model or provider changes.
  // Config override takes precedence — only fetch if no override is set.
  useEffect(() => {
    if (activeProvider.contextWindow) {
      setContextWindow(activeProvider.contextWindow);
      return;
    }
    const key = resolveApiKey(activeProvider.type, activeProvider.apiKey);
    let cancelled = false;
    fetchContextWindow(
      activeProvider.baseUrl,
      activeModel,
      activeProvider.type,
      key,
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
    activeProvider.apiKey,
    activeModel,
  ]);

  const addMessages = (...msgs: DisplayMessage[]) => {
    setMessages((prev) => [...prev, ...msgs]);
  };

  const clearMessages = () => {
    if (onRestart) {
      onRestart();
      return;
    }
    const newSession = createSession(activeProvider.name, activeModel);
    sessionRef.current = newSession;

    pendingMessageRef.current = null;
    setPendingMessage(null);
    inputHistoryRef.current = [];
    abortRef.current?.abort();
    mcpManagerRef.current?.shutdown();
    mcpManagerRef.current = null;
    setMessages([]);
    setStreaming(false);
    setStreamingContent("");
    setError(null);
    setActiveCommand(null);
    abortRef.current = null;
    setTokenUsage(null);
  };

  const submit = async (text: string, clipboardImages?: ImageAttachment[]) => {
    // Record in input history for up/down recall. Deduplicate consecutive
    // entries so re-submitting a queued message doesn't create a duplicate.
    const history = inputHistoryRef.current;
    if (text.trim() && history[history.length - 1] !== text) {
      history.push(text);
    }

    if (streamingRef.current) {
      pendingMessageRef.current = text;
      setPendingMessage(text);
      return;
    }

    const skillResult = parseSkillInvocation(text);
    if ("error" in skillResult) {
      addMessages(
        { id: crypto.randomUUID(), role: "user", content: text },
        skillResult.error,
      );
      return;
    }
    const { chatText, skillDisplay } = skillResult;

    const parsed = parse(chatText);

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
          const freshCfg = loadConfig();
          const provider = getProviderByName(freshCfg, name);
          if (!provider) {
            const available = freshCfg.providers.map((p) => p.name).join(", ");
            return `Unknown provider: ${name}. Available: ${available}`;
          }
          setActiveProviderState(provider);
          setProviders(freshCfg.providers);
          updateActiveProvider(name);
          return null;
        },
        reloadProviders: () => {
          const freshCfg = loadConfig();
          setProviders(freshCfg.providers);
        },
        providerBaseUrl: activeProvider.baseUrl,
        activeModel,
        activeProvider: activeProvider.name,
        providers: providers.map((p) => ({
          name: p.name,
          baseUrl: p.baseUrl,
          type: p.type,
          apiKey: p.apiKey,
        })),
        contextWindow,
        maxTokens: getMaxTokens(config, activeProvider, activeModel),
        tokenUsage,
        messageCount: messages.length,
        mcpFailedServers: mcpWarnings
          .map((w) => {
            const match = w.match(/^MCP server "(.+?)":/);
            return match?.[1];
          })
          .filter((n): n is string => n !== undefined),
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
      content: chatText,
      ...(clipboardImages &&
        clipboardImages.length > 0 && { images: clipboardImages }),
    };

    if (skillDisplay) {
      setMessages((prev) => [...prev, skillDisplay]);
    } else {
      setMessages((prev) => [...prev, userMsg]);
    }
    appendMessage(sessionRef.current, userMsg);
    streamingRef.current = true;
    setStreaming(true);
    setStreamingContent("");
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    // Track the full message list across tool-call iterations so each
    // re-call to the provider includes prior tool results.
    let currentMessages: DisplayMessage[] = [...messages, userMsg];

    // Reload config from disk so we pick up changes from /grant and /tools.
    const freshConfig = loadConfig();
    const maxTokens = getMaxTokens(config, activeProvider, activeModel);
    const toolAvailability = resolveToolAvailability(freshConfig.tools);
    const builtInToolDefs = getToolDefinitions(toolAvailability);

    // Start or restart MCP servers if config changed.
    const mcpServers = getMcpServers(freshConfig);
    const desiredNames = Object.keys(mcpServers).sort().join(",");
    const currentNames = mcpManagerRef.current
      ? mcpManagerRef.current.getServerNames().sort().join(",")
      : "";

    if (desiredNames !== currentNames) {
      mcpManagerRef.current?.shutdown();
      mcpManagerRef.current = null;

      if (desiredNames) {
        const manager = new McpManager();
        try {
          await manager.startAll(mcpServers);
          mcpManagerRef.current = manager;
        } catch {
          // MCP server startup failed — continue without MCP tools.
        }
      }
    }

    // Build MCP tool enabled set from per-server config.
    const allMcpServersConfig = getAllMcpServers(freshConfig);
    const mcpToolEnabled = new Set<string>();
    for (const [serverName, serverConfig] of Object.entries(
      allMcpServersConfig,
    )) {
      for (const tool of serverConfig.tools ?? []) {
        if (tool.enabled) {
          mcpToolEnabled.add(encodeToolName(serverName, tool.name));
        }
      }
    }

    const allMcpToolDefs = mcpManagerRef.current
      ? await mcpManagerRef.current.getToolDefinitions().catch(() => [])
      : [];
    const mcpToolDefs = allMcpToolDefs.filter((t) =>
      mcpToolEnabled.has(t.function.name),
    );
    const toolDefs = [...builtInToolDefs, ...mcpToolDefs];

    const permissions = resolvePermissions(freshConfig.permissions);

    const apiKey = resolveApiKey(activeProvider.type, activeProvider.apiKey);

    const toolContext = buildToolContext({
      setActiveCommand,
      setStreamingContent,
      permissions,
      signal: controller.signal,
      providerConfig: {
        baseUrl: activeProvider.baseUrl,
        model: activeModel,
        apiKey,
        maxTokens,
        contextWindow,
      },
      allowedCommands: getAllowedCommands(freshConfig),
    });

    try {
      const result = await runCompletionLoop({
        baseUrl: activeProvider.baseUrl,
        model: activeModel,
        apiKey,
        systemMessage,
        initialMessages: toChatMessages(currentMessages, null),
        tools: toolDefs.length > 0 ? toolDefs : undefined,
        toolContext,
        maxTokens,
        contextWindow,
        lastPromptTokens: tokenUsage?.promptTokens ?? null,
        signal: controller.signal,
        mcpManager: mcpManagerRef.current ?? undefined,
        toolAvailability: {
          ...toolAvailability,
          ...Object.fromEntries(
            allMcpToolDefs.map((t) => [
              t.function.name,
              mcpToolEnabled.has(t.function.name),
            ]),
          ),
        },
        onContent: setStreamingContent,
        onMessage: (msg) => {
          const displayMsg = {
            id: crypto.randomUUID(),
            ...msg,
          } as DisplayMessage;
          currentMessages = [...currentMessages, displayMsg];
          setMessages(currentMessages);
          appendMessage(sessionRef.current, displayMsg);
        },
        onToolActive: setToolActive,
        onUsage: setTokenUsage,
      });

      if (result.aborted && !result.content) {
        // No response at all — remove the orphaned user message from
        // LLM context and session so it doesn't pollute the next turn.
        currentMessages = currentMessages.filter((m) => m.id !== userMsg.id);
        removeLastMessage(sessionRef.current);
      }
      if (result.aborted) {
        setMessages(currentMessages);
      }
    } catch (err) {
      setError(getErrorMessage(err));
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

  /** Clears the pending message without aborting the active stream. */
  const cancelPending = () => {
    pendingMessageRef.current = null;
    setPendingMessage(null);
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
    toolActive,
    inputHistory: inputHistoryRef.current,
    mcpWarnings,
    submit,
    cancel,
    cancelPending,
    clearMessages,
  };
}
