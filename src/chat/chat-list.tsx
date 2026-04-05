import { Box, Static, Text } from "ink";
import type { ReactNode } from "react";
import { completePartialMarkdown, renderMarkdown } from "../markdown/render";
import type { ChatMessage, ToolCallInfo } from "./message";
import { theme } from "../ui/theme";
import { Indent } from "../ui/layout/indent";

/** A static item — either the header or a chat message. */
type StaticItem =
  | { kind: "header"; id: string }
  | { kind: "message"; message: ChatMessage };

/** Props for ChatList. */
interface ChatListProps {
  messages: ChatMessage[];
  /** Optional header rendered as the first static item. */
  header?: ReactNode;
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

/** Renders an assistant response with markdown formatting. */
function AssistantMessageView(props: { content: string }) {
  return (
    <Box paddingBottom={1}>
      <Indent>
        <Text>{renderMarkdown(props.content)}</Text>
      </Indent>
    </Box>
  );
}

/** Renders a dimmed interrupted notice. */
function InterruptedMessageView() {
  return (
    <Box paddingBottom={1}>
      <Indent>
        <Text dimColor>Interrupted</Text>
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

/** Renders a tool call from the assistant. */
function ToolCallMessageView(props: { toolCalls: ToolCallInfo[] }) {
  return (
    <Box paddingBottom={1}>
      <Indent>
        {props.toolCalls.map((tc) => (
          <Text key={tc.id} dimColor>
            ⚙ {tc.name}
          </Text>
        ))}
      </Indent>
    </Box>
  );
}

/** Renders a tool execution result. */
function ToolResultMessageView(props: { toolName: string; output: string }) {
  return (
    <Box paddingBottom={1}>
      <Indent>
        <Text dimColor>
          ↳ {props.toolName}:{" "}
          {props.output.length > 200
            ? `${props.output.slice(0, 200)}…`
            : props.output}
        </Text>
      </Indent>
    </Box>
  );
}

/** Renders the chat message list. Messages are rendered once and persist on screen. */
export function ChatList(props: ChatListProps) {
  const items: StaticItem[] = [];
  if (props.header) {
    items.push({ kind: "header", id: "__header__" });
  }
  for (const msg of props.messages) {
    items.push({ kind: "message", message: msg });
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <Static items={items}>
      {(item) => {
        if (item.kind === "header") {
          return (
            <Box key={item.id} flexDirection="column" paddingBottom={1}>
              {props.header}
            </Box>
          );
        }
        const message = item.message;
        if (message.role === "user") {
          return <UserMessageView key={message.id} content={message.content} />;
        }
        if (message.role === "assistant") {
          return (
            <AssistantMessageView key={message.id} content={message.content} />
          );
        }
        if (message.role === "interrupted") {
          return <InterruptedMessageView key={message.id} />;
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
        if (message.role === "tool-call") {
          return (
            <ToolCallMessageView
              key={message.id}
              toolCalls={message.toolCalls}
            />
          );
        }
        if (message.role === "tool-result") {
          return (
            <ToolResultMessageView
              key={message.id}
              toolName={message.toolName}
              output={message.output}
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

/** Renders the in-progress streaming assistant response with markdown formatting. */
export function LiveAssistantMessage(props: LiveAssistantMessageProps) {
  if (!props.content) {
    return null;
  }

  return (
    <Box paddingBottom={1}>
      <Indent>
        <Text>{renderMarkdown(completePartialMarkdown(props.content))}</Text>
      </Indent>
    </Box>
  );
}
