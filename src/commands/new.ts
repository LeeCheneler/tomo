import { register } from "./registry";
import type { Command } from "./types";

const newCommand: Command = {
  name: "new",
  description: "Start a new conversation",
  execute: (_args, { clearMessages }) => {
    clearMessages();
    return { output: "Conversation cleared." };
  },
};

register(newCommand);
