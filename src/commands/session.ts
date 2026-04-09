import { createElement } from "react";
import { SessionList } from "../session/session-list";
import type { CommandDefinition } from "./registry";

/** Opens the session list to browse saved sessions. */
export const sessionCommand: CommandDefinition = {
  name: "session",
  description: "Browse saved sessions",
  takeover: (onDone, context) =>
    createElement(SessionList, { onDone, context }),
};
