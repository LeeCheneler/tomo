/** A message sent by the user. */
export interface UserMessage {
  id: string;
  role: "user";
  content: string;
}

/** The result of a slash command invocation. */
export interface CommandMessage {
  id: string;
  role: "command";
  command: string;
  result: string;
}

/** Union of all chat message types. Discriminate on `role`. */
export type ChatMessage = UserMessage | CommandMessage;
