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

/** Union of all chat message types. Discriminate on `role`. */
export type ChatMessage =
  | UserMessage
  | AssistantMessage
  | CommandMessage
  | ErrorMessage
  | InterruptedMessage;
