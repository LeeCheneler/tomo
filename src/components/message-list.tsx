import { Box } from "ink";
import { AssistantMessage } from "./assistant-message";
import { SystemMessage } from "./system-message";
import { UserMessage } from "./user-message";

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
}

interface MessageListProps {
  messages: DisplayMessage[];
}

/** Renders a list of chat messages, dispatching to the appropriate component by role. */
export function MessageList({ messages }: MessageListProps) {
  return (
    <Box flexDirection="column" gap={1}>
      {messages.map((msg) => {
        if (msg.role === "user")
          return <UserMessage key={msg.id}>{msg.content}</UserMessage>;
        if (msg.role === "system")
          return <SystemMessage key={msg.id}>{msg.content}</SystemMessage>;
        return <AssistantMessage key={msg.id}>{msg.content}</AssistantMessage>;
      })}
    </Box>
  );
}
