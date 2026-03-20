import { createElement } from "react";
import { SessionSelector } from "../components/session-selector";
import { register } from "./registry";
import type { Command } from "./types";

const session: Command = {
  name: "session",
  description: "Load a previous session",
  execute: (args, callbacks) => {
    const id = args.trim();

    if (id) {
      const error = callbacks.switchSession(id);
      if (error) return { output: error };
      return { output: "Session loaded." };
    }

    return {
      interactive: createElement(SessionSelector, {
        onSelect: (selectedId: string) => {
          callbacks.switchSession(selectedId);
          callbacks.onComplete({ output: "Session loaded." });
        },
        onCancel: callbacks.onCancel,
      }),
    };
  },
};

register(session);
