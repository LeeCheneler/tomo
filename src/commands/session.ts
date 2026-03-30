import { createElement } from "react";
import { SessionSelector } from "../components/session-selector";
import { ok } from "../tools/types";
import { register } from "./registry";
import type { Command } from "./types";

const session: Command = {
  name: "session",
  description: "Load a previous session",
  execute: (args, callbacks) => {
    const id = args.trim();

    if (id) {
      const error = callbacks.switchSession(id);
      if (error) return ok(error);
      return ok("Session loaded.");
    }

    return {
      interactive: createElement(SessionSelector, {
        onSelect: (selectedId: string) => {
          callbacks.switchSession(selectedId);
          callbacks.onComplete(ok("Session loaded."));
        },
        onCancel: callbacks.onCancel,
      }),
    };
  },
};

register(session);
