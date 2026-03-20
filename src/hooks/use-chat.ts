import { useRef, useState } from "react";
import type { DisplayMessage } from "../components/message-list";
import type { ProviderConfig } from "../config";
import type { ChatMessage } from "../provider/client";
import { streamChatCompletion } from "../provider/client";

export interface ChatState {
  messages: DisplayMessage[];
  streaming: boolean;
  streamingContent: string;
  error: string | null;
  submit: (text: string) => void;
  cancel: () => void;
}

/** Manages conversation state and streaming for a chat session. */
export function useChat(provider: ProviderConfig): ChatState {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const submit = async (text: string) => {
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
      ...messages.map((m) => ({ role: m.role, content: m.content })),
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

  return { messages, streaming, streamingContent, error, submit, cancel };
}
