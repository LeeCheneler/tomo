import type { ReactElement } from "react";
import { useEffect, useRef, useState } from "react";
import { getCommand, parse } from "../commands";
import type { DisplayMessage } from "../components/message-list";
import {
  type Config,
  type ProviderConfig,
  getProviderByName,
  updateActiveModel,
  updateActiveProvider,
} from "../config";
import type { ChatMessage, TokenUsage } from "../provider/client";
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
  submit: (text: string) => void;
  cancel: () => void;
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
  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef<Session>(initialSession);

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

    abortRef.current?.abort();
    setMessages([]);
    setStreaming(false);
    setStreamingContent("");
    setError(null);
    setActiveCommand(null);
    abortRef.current = null;
  };

  const submit = async (text: string) => {
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
    setStreaming(true);
    setStreamingContent("");
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    const chatMessages: ChatMessage[] = [
      ...(systemMessage
        ? [{ role: "system" as const, content: systemMessage }]
        : []),
      ...messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      { role: "user" as const, content: text },
    ];

    let content = "";

    try {
      const completion = await streamChatCompletion({
        baseUrl: activeProvider.baseUrl,
        model: activeModel,
        messages: chatMessages,
        signal: controller.signal,
      });

      for await (const token of completion.content) {
        content += token;
        setStreamingContent(content);
      }

      const usage = completion.getUsage();
      if (usage) {
        setTokenUsage(usage);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User cancelled — keep what we have
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    if (content) {
      const assistantMsg: DisplayMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      appendMessage(sessionRef.current, assistantMsg);
    }

    setStreaming(false);
    setStreamingContent("");
    abortRef.current = null;
  };

  const cancel = () => {
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
    submit,
    cancel,
  };
}
