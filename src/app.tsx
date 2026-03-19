import { useRef, useState } from "react";
import { Box, Text } from "ink";
import { AssistantMessage } from "./components/assistant-message";
import { ChatInput } from "./components/chat-input";
import type { DisplayMessage } from "./components/message-list";
import { MessageList } from "./components/message-list";
import { env } from "./env";
import type { ChatMessage } from "./provider/client";
import { streamChatCompletion } from "./provider/client";
import { extractThinking } from "./provider/thinking";

const BASE_URL = env.getOptional("TOMO_BASE_URL") ?? "http://localhost:11434";
const MODEL = env.getOptional("TOMO_MODEL") ?? "qwen3:8b";

export function App() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [streamingThinking, setStreamingThinking] = useState("");
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const handleSubmit = async (text: string) => {
    const userMsg: DisplayMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setStreaming(true);
    setStreamingThinking("");
    setStreamingContent("");
    setError(null);

    const controller = new AbortController();
    abortRef.current = controller;

    const chatMessages: ChatMessage[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: text },
    ];

    let thinking = "";
    let content = "";

    try {
      const tokens = streamChatCompletion({
        baseUrl: BASE_URL,
        model: MODEL,
        messages: chatMessages,
        signal: controller.signal,
      });

      for await (const chunk of extractThinking(tokens)) {
        if (chunk.type === "thinking") {
          thinking += chunk.text;
          setStreamingThinking(thinking);
        } else {
          content += chunk.text;
          setStreamingContent(content);
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // User cancelled — keep what we have
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    }

    if (thinking || content) {
      const assistantMsg: DisplayMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content,
        thinking: thinking || undefined,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    }

    setStreaming(false);
    setStreamingThinking("");
    setStreamingContent("");
    abortRef.current = null;
  };

  const handleEscape = () => {
    abortRef.current?.abort();
  };

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color="cyan" bold>
        {" ╔╦╗╔═╗╔╦╗╔═╗\n  ║ ║ ║║║║║ ║\n  ╩ ╚═╝╩ ╩╚═╝"}
      </Text>
      <Text> </Text>
      <Text>
        <Text color="cyan" bold>
          {"  友"}
        </Text>
        <Text dimColor> — your local AI companion</Text>
      </Text>
      <Text> </Text>
      <Text dimColor>{"  v0.0.0"}</Text>
      <Text> </Text>

      <MessageList messages={messages} />

      {streaming && (streamingThinking || streamingContent) ? (
        <AssistantMessage thinking={streamingThinking}>
          {streamingContent}
        </AssistantMessage>
      ) : null}

      {error ? <Text color="red">{`Error: ${error}`}</Text> : null}

      <ChatInput
        onSubmit={handleSubmit}
        disabled={streaming}
        onEscape={handleEscape}
      />
    </Box>
  );
}
