import { Box, Text } from "ink";
import { AssistantMessage } from "./components/assistant-message";
import { ChatInput } from "./components/chat-input";
import { Header } from "./components/header";
import { MessageList } from "./components/message-list";
import { getActiveProvider, loadConfig } from "./config";
import { useChat } from "./hooks/use-chat";

const config = loadConfig();
const provider = getActiveProvider(config);

/** Root application component. Renders the chat UI and delegates state to useChat. */
export function App() {
  const chat = useChat(provider);

  return (
    <Box flexDirection="column" paddingX={1}>
      <Header model={provider.model} />

      <MessageList messages={chat.messages} />

      {chat.streaming && chat.streamingContent ? (
        <AssistantMessage>{chat.streamingContent}</AssistantMessage>
      ) : null}

      {chat.error ? <Text color="red">{`Error: ${chat.error}`}</Text> : null}

      <ChatInput
        onSubmit={chat.submit}
        disabled={chat.streaming}
        onEscape={chat.cancel}
      />
    </Box>
  );
}
