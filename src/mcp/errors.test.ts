import { describe, expect, it } from "vitest";
import { McpAuthCancelledError } from "./errors";

describe("McpAuthCancelledError", () => {
  it("embeds the server name in the message", () => {
    const err = new McpAuthCancelledError("github");
    expect(err.message).toBe("MCP server 'github' authorization cancelled");
  });

  it("has the class name set for instanceof and logging", () => {
    const err = new McpAuthCancelledError("github");
    expect(err.name).toBe("McpAuthCancelledError");
    expect(err instanceof McpAuthCancelledError).toBe(true);
    expect(err instanceof Error).toBe(true);
  });
});
