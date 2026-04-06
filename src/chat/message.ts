/** A message sent by the user. */
export interface UserMessage {
  id: string;
  role: "user";
  content: string;
}

/** A response from the assistant. */
export interface AssistantMessage {
  id: string;
  role: "assistant";
  content: string;
}

/** The result of a slash command invocation. */
export interface CommandMessage {
  id: string;
  role: "command";
  command: string;
  result: string;
}

/** An error message displayed in the chat. */
export interface ErrorMessage {
  id: string;
  role: "error";
  content: string;
}

/** A notice that a response was interrupted by the user. */
export interface InterruptedMessage {
  id: string;
  role: "interrupted";
}

/** A tool call from the assistant. */
export interface ToolCallInfo {
  id: string;
  name: string;
  displayName: string;
  arguments: string;
}

/** An assistant response that includes tool calls. */
export interface ToolCallMessage {
  id: string;
  role: "tool-call";
  content: string;
  toolCalls: ToolCallInfo[];
}

/** The result of executing a tool. */
export interface ToolResultMessage {
  id: string;
  role: "tool-result";
  toolCallId: string;
  toolName: string;
  output: string;
}

/** Union of all chat message types. Discriminate on `role`. */
export type ChatMessage =
  | UserMessage
  | AssistantMessage
  | CommandMessage
  | ErrorMessage
  | InterruptedMessage
  | ToolCallMessage
  | ToolResultMessage;
