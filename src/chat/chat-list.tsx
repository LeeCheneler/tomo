import { Box, Static, Text } from "ink";
import type { ReactNode } from "react";
import { completePartialMarkdown, renderMarkdown } from "../markdown/render";
import { DiffView } from "../ui/diff-view";
import { Indent } from "../ui/layout/indent";
import { theme } from "../ui/theme";
import type { ChatMessage, ToolCallInfo } from "./message";

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

/** Renders a user message with a cyan indicator and optional image badges. */
function UserMessageView(props: {
  content: string;
  images?: { name: string; dataUri: string }[];
}) {
  return (
    <Box flexDirection="column" paddingBottom={1}>
      <Box>
        <Text color={theme.brand}>{"❯ "}</Text>
        <Text color={theme.brand}>{props.content}</Text>
      </Box>
      {props.images && props.images.length > 0 && (
        <Box paddingLeft={2} gap={1}>
          {props.images.map((img) => (
            <Text key={img.dataUri} dimColor>
              [{img.name}]
            </Text>
          ))}
        </Box>
      )}
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

/** Renders a dimmed informational notice. */
function InfoMessageView(props: { content: string }) {
  return (
    <Box paddingBottom={1}>
      <Indent>
        <Text dimColor>{props.content}</Text>
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

/** Renders a skill invocation with the skill name in the skill color. */
function SkillMessageView(props: { skillName: string }) {
  return (
    <Box paddingBottom={1}>
      <Text color={theme.skill}>{"❯ "}</Text>
      <Text color={theme.skill}>skill ({props.skillName})</Text>
    </Box>
  );
}

/** Renders a tool call from the assistant. */
function ToolCallMessageView(props: { toolCalls: ToolCallInfo[] }) {
  return (
    <Box flexDirection="column" paddingBottom={1}>
      {props.toolCalls.map((tc) => (
        <Indent key={tc.id}>
          <Text color={theme.tool}>{tc.displayName}</Text>
          {tc.summary ? <Text dimColor> {tc.summary}</Text> : null}
        </Indent>
      ))}
    </Box>
  );
}

/** Maximum lines of plain tool output to display. */
const MAX_TOOL_OUTPUT_LINES = 5;

/** Keeps only the last N lines of output, showing a hidden count for the rest. */
function tailLines(output: string, maxLines: number): string {
  const lines = output.split("\n");
  if (lines.length <= maxLines) return output;
  const hidden = lines.length - maxLines;
  return `…[${hidden} more lines]\n${lines.slice(-maxLines).join("\n")}`;
}

/** Renders a tool execution result. Errors and denials are shown in red. */
function ToolResultMessageView(props: {
  output: string;
  status: "ok" | "error" | "denied";
  format: "plain" | "diff";
}) {
  const isError = props.status === "error" || props.status === "denied";

  if (props.format === "diff" && !isError) {
    return (
      <Box paddingBottom={1}>
        <Indent>
          <DiffView output={props.output} />
        </Indent>
      </Box>
    );
  }

  return (
    <Box paddingBottom={1}>
      <Indent>
        <Text dimColor={!isError} color={isError ? theme.error : undefined}>
          {tailLines(props.output, MAX_TOOL_OUTPUT_LINES)}
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
          return (
            <UserMessageView
              key={message.id}
              content={message.content}
              images={message.images}
            />
          );
        }
        if (message.role === "assistant") {
          return (
            <AssistantMessageView key={message.id} content={message.content} />
          );
        }
        if (message.role === "interrupted") {
          return <InterruptedMessageView key={message.id} />;
        }
        if (message.role === "info") {
          return <InfoMessageView key={message.id} content={message.content} />;
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
        if (message.role === "skill") {
          return (
            <SkillMessageView key={message.id} skillName={message.skillName} />
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
              output={message.output}
              status={message.status}
              format={message.format}
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

/** Props for LiveToolOutput. */
export interface LiveToolOutputProps {
  output: string;
}

/** Renders streaming tool output, showing only the last few lines. */
export function LiveToolOutput(props: LiveToolOutputProps) {
  if (!props.output) {
    return null;
  }

  return (
    <Box paddingBottom={1}>
      <Indent>
        <Text dimColor>{tailLines(props.output, MAX_TOOL_OUTPUT_LINES)}</Text>
      </Indent>
    </Box>
  );
}
