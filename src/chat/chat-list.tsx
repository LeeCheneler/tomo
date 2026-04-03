import { Box, Static, Text } from "ink";
import type { ChatMessage } from "./message";
import { theme } from "../ui/theme";

/** Props for ChatList. */
interface ChatListProps {
  messages: ChatMessage[];
}

/** Renders a user message with a cyan indicator. */
function UserMessageView(props: { content: string }) {
  return (
    <Box paddingBottom={1}>
      <Text color={theme.brand}>{"❯ "}</Text>
      <Text>{props.content}</Text>
    </Box>
  );
}

/** Renders a command invocation and its result. */
function CommandMessageView(props: { command: string; result: string }) {
  return (
    <Box flexDirection="column" paddingBottom={1}>
      <Text dimColor>/{props.command}</Text>
      <Text>{props.result}</Text>
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
