import { ok } from "../tools/types";
import { register } from "./registry";
import type { Command } from "./types";

const newCommand: Command = {
  name: "new",
  description: "Start a new conversation",
  execute: (_args, { clearMessages }) => {
    clearMessages();
    return ok("Conversation cleared.");
  },
};

register(newCommand);
