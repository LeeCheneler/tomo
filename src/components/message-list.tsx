import { Box } from "ink";
import type { ToolCall } from "../provider/client";
import { AssistantMessage } from "./assistant-message";
import { SystemMessage } from "./system-message";
import { UserMessage } from "./user-message";

export type DisplayMessage =
  | { id: string; role: "user"; content: string }
  | { id: string; role: "system"; content: string }
  | { id: string; role: "assistant"; content: string; tool_calls?: ToolCall[] }
  | { id: string; role: "tool"; content: string; tool_call_id: string };

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
