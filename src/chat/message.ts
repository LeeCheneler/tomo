/** A message sent by the user. */
export interface UserMessage {
  id: string;
  role: "user";
  content: string;
}

/** Union of all chat message types. Discriminate on `role`. */
export type ChatMessage = UserMessage;
