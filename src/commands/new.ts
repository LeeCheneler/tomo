import type { CommandDefinition } from "./registry";

/** Clears the conversation and starts a new session. */
export const newCommand: CommandDefinition = {
  name: "new",
  description: "Start a new session",
  handler: (context) => {
    context.resetSession();
    return "Started new session.";
  },
};
