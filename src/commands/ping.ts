import type { CommandDefinition } from "./registry";

/** Responds with pong. Useful for verifying command execution works. */
export const pingCommand: CommandDefinition = {
  name: "ping",
  description: "Responds with pong",
  handler: () => "pong",
};
