import type { ReactElement } from "react";
import { useRef, useState } from "react";
import { getCommand, parse } from "../commands";
import type { DisplayMessage } from "../components/message-list";
import type { ProviderConfig } from "../config";
import type { ChatMessage } from "../provider/client";
import { streamChatCompletion } from "../provider/client";

export interface ChatState {
  messages: DisplayMessage[];
  streaming: boolean;
  streamingContent: string;
  error: string | null;
  activeCommand: ReactElement | null;
  submit: (text: string) => void;
  cancel: () => void;
}

/** Manages conversation state and streaming for a chat session. */
export function useChat(provider: ProviderConfig): ChatState {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeCommand, setActiveCommand] = useState<ReactElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const addMessages = (...msgs: DisplayMessage[]) => {
    setMessages((prev) => [...prev, ...msgs]);
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

      const result = command.execute(parsed.args, {
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
    setStreaming(true);
    setStreamingContent("");
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    const chatMessages: ChatMessage[] = [
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
      for await (const token of streamChatCompletion({
        baseUrl: provider.baseUrl,
        model: provider.model,
        messages: chatMessages,
        signal: controller.signal,
      })) {
        content += token;
        setStreamingContent(content);
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
    submit,
    cancel,
  };
}
