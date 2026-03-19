import { Box } from "ink";
import { AssistantMessage } from "./assistant-message";
import { UserMessage } from "./user-message";

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface MessageListProps {
  messages: DisplayMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  return (
    <Box flexDirection="column" gap={1}>
      {messages.map((msg) =>
        msg.role === "user" ? (
          <UserMessage key={msg.id}>{msg.content}</UserMessage>
        ) : (
          <AssistantMessage key={msg.id}>{msg.content}</AssistantMessage>
        ),
      )}
    </Box>
  );
}
