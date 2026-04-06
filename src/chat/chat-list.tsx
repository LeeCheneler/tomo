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

/** Formats tool call arguments as a single-line summary (e.g. "path: ./foo.ts"). */
function formatArgs(argsJson: string): string {
  try {
    const parsed = JSON.parse(argsJson);
    if (typeof parsed !== "object" || parsed === null) return "";
    return Object.entries(parsed)
      .map(([key, value]) => `${key}: ${String(value)}`)
      .join("  ");
  } catch {
    return "";
  }
}

/** Renders a tool call from the assistant. */
function ToolCallMessageView(props: { toolCalls: ToolCallInfo[] }) {
  return (
    <Box flexDirection="column" paddingBottom={1}>
      {props.toolCalls.map((tc) => {
        const args = formatArgs(tc.arguments);
        return (
          <Indent key={tc.id}>
            <Text color={theme.tool}>{tc.displayName}</Text>
            {args ? <Text dimColor> ({args})</Text> : null}
          </Indent>
        );
      })}
    </Box>
  );
}

/** Maximum lines of tool output to display. */
const MAX_TOOL_OUTPUT_LINES = 5;

/** Truncates output to a maximum number of lines. */
function truncateLines(output: string, maxLines: number): string {
  const lines = output.split("\n");
  if (lines.length <= maxLines) return output;
  return `${lines.slice(0, maxLines).join("\n")}\n…`;
}

/** Renders a tool execution result. */
function ToolResultMessageView(props: { output: string }) {
  return (
    <Box paddingBottom={1}>
      <Indent>
        <Text dimColor>
          {truncateLines(props.output, MAX_TOOL_OUTPUT_LINES)}
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
            <ToolResultMessageView key={message.id} output={message.output} />
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
