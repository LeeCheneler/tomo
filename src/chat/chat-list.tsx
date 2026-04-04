import { Box, Static, Text } from "ink";
import type { ChatMessage } from "./message";
import { theme } from "../ui/theme";
import { Indent } from "../ui/layout/indent";

/** Props for ChatList. */
interface ChatListProps {
  messages: ChatMessage[];
}

/** Renders a user message with a cyan indicator. */
function UserMessageView(props: { content: string }) {
  return (
    <Box paddingBottom={1}>
      <Text color={theme.brand}>{"❯ "}</Text>
      <Text color={theme.brand}>{props.content}</Text>
    </Box>
  );
}

/** Renders an assistant response. */
function AssistantMessageView(props: { content: string }) {
  return (
    <Box paddingBottom={1}>
      <Indent>
        <Text>{props.content}</Text>
      </Indent>
    </Box>
  );
}

/** Renders an error message in red. */
function ErrorMessageView(props: { content: string }) {
  return (
    <Box paddingBottom={1}>
      <Indent>
        <Text color={theme.error}>{props.content}</Text>
      </Indent>
    </Box>
  );
}

/** Renders a command invocation and its result. */
function CommandMessageView(props: { command: string; result: string }) {
  return (
    <Box paddingBottom={1}>
      <Text dimColor>{"❯ "}</Text>
      <Box flexDirection="column">
        <Box paddingBottom={1}>
          <Text dimColor>/{props.command}</Text>
        </Box>
        <Text>{props.result}</Text>
      </Box>
    </Box>
  );
}

/** Renders the chat message list. Messages are rendered once and persist on screen. */
export function ChatList(props: ChatListProps) {
  if (props.messages.length === 0) {
    return null;
  }

  return (
    <Static items={props.messages}>
      {(message) => {
        if (message.role === "user") {
          return <UserMessageView key={message.id} content={message.content} />;
        }
        if (message.role === "assistant") {
          return (
            <AssistantMessageView key={message.id} content={message.content} />
          );
        }
        if (message.role === "error") {
          return (
            <ErrorMessageView key={message.id} content={message.content} />
          );
        }
        if (message.role === "command") {
          return (
            <CommandMessageView
              key={message.id}
              command={message.command}
              result={message.result}
            />
          );
        }
        return null;
      }}
    </Static>
  );
}

/** Props for LiveAssistantMessage. */
export interface LiveAssistantMessageProps {
  content: string;
}

/** Renders the in-progress streaming assistant response below the static message list. */
export function LiveAssistantMessage(props: LiveAssistantMessageProps) {
  if (!props.content) {
    return null;
  }

  return (
    <Box paddingBottom={1}>
      <Text>{props.content}</Text>
    </Box>
  );
}
