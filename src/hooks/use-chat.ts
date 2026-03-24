import chalk from "chalk";
import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import { getCommand, parse } from "../commands";
import type { DisplayMessage } from "../components/message-list";
import {
  type Config,
  getMaxTokens,
  getProviderByName,
  loadConfig,
  type ProviderConfig,
  updateActiveModel,
  updateActiveProvider,
} from "../config";
import { truncateMessages } from "../context/truncate";
import type { ImageAttachment } from "../images";
import { resolvePermissions } from "../permissions";
import type { ChatMessage, ContentPart, TokenUsage } from "../provider/client";
import {
  fetchContextWindow,
  getDefaultContextWindow,
  resolveApiKey,
  streamChatCompletion,
} from "../provider/client";
import {
  appendMessage,
  createSession,
  loadSession,
  type Session,
} from "../session";
import { getSkill } from "../skills";
import {
  getToolDefinitions,
  resolveToolAvailability,
  type ToolContext,
} from "../tools";
import { executeToolCalls, ToolDismissedError } from "./tool-execution";

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
  submit: (text: string, clipboardImages?: ImageAttachment[]) => void;
  cancel: () => void;
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
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

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
    abortRef.current?.abort();
    setMessages([]);
    setStreaming(false);
    setStreamingContent("");
    setError(null);
    setActiveCommand(null);
    abortRef.current = null;
    setTokenUsage(null);
  };

  const submit = async (text: string, clipboardImages?: ImageAttachment[]) => {
    if (streamingRef.current) {
      pendingMessageRef.current = text;
      setPendingMessage(text);
      return;
    }

    // Skill invocation: //skill-name [args]
    let chatText = text;
    let skillDisplay: DisplayMessage | null = null;
    if (text.startsWith("//")) {
      const rest = text.slice(2);
      const spaceIndex = rest.indexOf(" ");
      const skillName = spaceIndex === -1 ? rest : rest.slice(0, spaceIndex);
      const skillArgs =
        spaceIndex === -1 ? "" : rest.slice(spaceIndex + 1).trim();
      const skill = getSkill(skillName);

      if (!skill) {
        addMessages(
          { id: crypto.randomUUID(), role: "user", content: text },
          {
            id: crypto.randomUUID(),
            role: "system",
            content: `Unknown skill: //${skillName}. Type /skills for available skills.`,
          },
        );
        return;
      }

      // Replace input with skill body, appending any args.
      chatText = skillArgs ? `${skill.body}\n\n${skillArgs}` : skill.body;

      // Format a tool-style display message for the UI.
      skillDisplay = {
        id: crypto.randomUUID(),
        role: "system",
        content: skillArgs
          ? `${chalk.bold.yellow(`skill(${skillName})`)}  ${chalk.dim(skillArgs)}`
          : chalk.bold.yellow(`skill(${skillName})`),
      };
    }

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
    const toolDefs = getToolDefinitions(toolAvailability);

    const permissions = resolvePermissions(freshConfig.permissions);

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
      permissions,
    };

    let aborted = false;
    // Declared outside the loop so partial content survives abort.
    let content = "";
    let emptyResponseRetries = 0;
    const MAX_EMPTY_RETRIES = 3;
    // Ephemeral nudge message — sent to the provider on empty responses
    // but never persisted to history or shown to the user.
    let nudgeMessage: ChatMessage | null = null;

    try {
      // Tool loop: stream a completion, check for tool calls, execute
      // them, and re-call the provider until the model responds with
      // content only (no more tool calls).
      while (true) {
        content = "";

        const chatMessages = truncateMessages(
          toChatMessages(currentMessages, systemMessage),
          contextWindow,
          maxTokens,
          tokenUsage?.promptTokens ?? null,
        );

        // Append ephemeral nudge if the model returned an empty response.
        if (nudgeMessage) {
          chatMessages.push(nudgeMessage);
          nudgeMessage = null;
        }

        const apiKey = resolveApiKey(
          activeProvider.type,
          activeProvider.apiKey,
        );
        const completion = await streamChatCompletion({
          baseUrl: activeProvider.baseUrl,
          model: activeModel,
          messages: chatMessages,
          maxTokens,
          signal: controller.signal,
          ...(toolDefs.length > 0 && { tools: toolDefs }),
          ...(apiKey && { apiKey }),
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
          // Empty response — nudge the model to continue instead of
          // silently ending the turn. This helps smaller models that
          // stall after receiving tool results.
          if (!content.trim() && emptyResponseRetries < MAX_EMPTY_RETRIES) {
            emptyResponseRetries++;
            nudgeMessage = {
              role: "user",
              content:
                "Your previous response was empty. Continue working on the task. If you need to use a tool, call it now. If you are done, summarize what was accomplished.",
            };
            continue;
          }

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

        // Model produced a real response — reset retry counter.
        emptyResponseRetries = 0;

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
    submit,
    cancel,
    clearMessages,
  };
}
