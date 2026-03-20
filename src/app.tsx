import { createRequire } from "node:module";
import { useRef, useState } from "react";
import { Box, Text } from "ink";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");
import { AssistantMessage } from "./components/assistant-message";
import { ChatInput } from "./components/chat-input";
import type { DisplayMessage } from "./components/message-list";
import { MessageList } from "./components/message-list";
import { getActiveProvider, loadConfig } from "./config";
import type { ChatMessage } from "./provider/client";
import { streamChatCompletion } from "./provider/client";

const LOGO = `
 ╔╦╗╔═╗╔╦╗╔═╗
  ║ ║ ║║║║║ ║
  ╩ ╚═╝╩ ╩╚═╝
`;

const config = loadConfig();
const provider = getActiveProvider(config);

/** Root application component. Manages the conversation loop and renders the chat UI. */
export function App() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
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

  const handleEscape = () => {
    abortRef.current?.abort();
  };

  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color="cyan" bold>
        {LOGO}
      </Text>
      <Text> </Text>
      <Text>
        <Text color="cyan" bold>
          {"  友"}
        </Text>
        <Text dimColor> — your local AI companion</Text>
      </Text>
      <Text> </Text>
      <Text dimColor>{`  v${version}`}</Text>
      <Text> </Text>

      <MessageList messages={messages} />

      {streaming && streamingContent ? (
        <AssistantMessage>{streamingContent}</AssistantMessage>
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
