import { Box, Text } from "ink";
import "./commands";
import { AssistantMessage } from "./components/assistant-message";
import { ChatInput } from "./components/chat-input";
import { Header } from "./components/header";
import { completePartialMarkdown } from "./components/markdown";
import { MessageList } from "./components/message-list";
import { ThinkingIndicator } from "./components/thinking-indicator";
import { getActiveProvider, loadConfig } from "./config";
import { useChat } from "./hooks/use-chat";
import { loadInstructions } from "./instructions";
import { createSession } from "./session";

const config = loadConfig();
const initialProvider = getActiveProvider(config);
const initialSession = createSession(initialProvider.name, config.activeModel);
const instructions = loadInstructions();

/** Root application component. Renders the chat UI and delegates state to useChat. */
export function App() {
  const chat = useChat(
    config,
    initialProvider,
    config.activeModel,
    initialSession,
    instructions,
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
          <AssistantMessage>
            {completePartialMarkdown(chat.streamingContent)}
          </AssistantMessage>
        </Box>
      ) : null}

      {chat.error ? (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="red">{`Error: ${chat.error}`}</Text>
        </Box>
      ) : null}

      {chat.pendingMessage ? (
        <Box marginBottom={1}>
          <Text>
            <Text color="yellow" bold>
              {"Queued: "}
            </Text>
            <Text backgroundColor="gray" color="white">
              {chat.pendingMessage}
            </Text>
          </Text>
        </Box>
      ) : null}

      {chat.streaming && !chat.streamingContent && !chat.activeCommand ? (
        <ThinkingIndicator />
      ) : null}

      {chat.activeCommand ? (
        chat.activeCommand
      ) : (
        <ChatInput
          onSubmit={chat.submit}
          onEscape={chat.cancel}
          contextPercent={
            chat.tokenUsage
              ? ((chat.tokenUsage.promptTokens +
                  chat.tokenUsage.completionTokens) /
                  chat.contextWindow) *
                100
              : null
          }
        />
      )}
    </Box>
  );
}
