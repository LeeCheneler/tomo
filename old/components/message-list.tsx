import { Box } from "ink";
import type { ImageAttachment } from "../images";
import type { ToolCall } from "../provider/client";
import { AssistantMessage } from "./assistant-message";
import { SystemMessage } from "./system-message";
import { ToolMessage } from "./tool-message";
import { UserMessage } from "./user-message";

export type DisplayMessage =
  | { id: string; role: "user"; content: string; images?: ImageAttachment[] }
  | { id: string; role: "system"; content: string }
  | { id: string; role: "assistant"; content: string; tool_calls?: ToolCall[] }
  | { id: string; role: "tool"; content: string; tool_call_id: string };

/** Renders a single message, dispatching to the appropriate component by role. */
export function Message({ msg }: { msg: DisplayMessage }) {
  if (msg.role === "user")
    return (
      <UserMessage imageCount={msg.images?.length}>{msg.content}</UserMessage>
    );
  if (msg.role === "system")
    return <SystemMessage>{msg.content}</SystemMessage>;
  if (msg.role === "tool") return <ToolMessage>{msg.content}</ToolMessage>;
  return <AssistantMessage>{msg.content}</AssistantMessage>;
}

interface MessageListProps {
  messages: DisplayMessage[];
}

/** Renders a list of chat messages. */
export function MessageList({ messages }: MessageListProps) {
  return (
    <Box flexDirection="column" gap={1}>
      {messages.map((msg) => (
        <Message key={msg.id} msg={msg} />
      ))}
    </Box>
  );
}
