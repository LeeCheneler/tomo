import { Box, Text } from "ink";
import "./commands";
import { AssistantMessage } from "./components/assistant-message";
import { ChatInput } from "./components/chat-input";
import { Header } from "./components/header";
import { MessageList } from "./components/message-list";
import { ThinkingIndicator } from "./components/thinking-indicator";
import { getActiveProvider, loadConfig } from "./config";
import { useChat } from "./hooks/use-chat";
import { createSession } from "./session";

const config = loadConfig();
const initialProvider = getActiveProvider(config);
const initialSession = createSession(initialProvider.name, config.activeModel);

/** Root application component. Renders the chat UI and delegates state to useChat. */
export function App() {
  const chat = useChat(
    config,
    initialProvider,
    config.activeModel,
    initialSession,
  );

  return (
    <Box flexDirection="column" paddingX={1}>
      <Header model={chat.activeModel} />

      {chat.messages.length > 0 ? (
        <Box flexDirection="column" marginBottom={1}>
          <MessageList messages={chat.messages} />
        </Box>
      ) : null}

      {chat.streaming && chat.streamingContent ? (
        <Box flexDirection="column" marginBottom={1}>
          <AssistantMessage>{chat.streamingContent}</AssistantMessage>
        </Box>
      ) : null}

      {chat.error ? (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="red">{`Error: ${chat.error}`}</Text>
        </Box>
      ) : null}

      {chat.streaming && !chat.streamingContent ? <ThinkingIndicator /> : null}

      {chat.activeCommand ? (
        chat.activeCommand
      ) : (
        <ChatInput
          onSubmit={chat.submit}
          disabled={chat.streaming}
          onEscape={chat.cancel}
        />
      )}
    </Box>
  );
}
