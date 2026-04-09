import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../config/file";
import type { Config } from "../config/schema";
import { renderInk } from "../test-utils/ink";
import { keys } from "../test-utils/keys";
import { McpServersScreen } from "./mcp-servers";

const COLUMNS = 80;

/** Override process.stdout.columns for test predictability. */
function setColumns(width: number | undefined) {
  Object.defineProperty(process.stdout, "columns", {
    value: width,
    writable: true,
    configurable: true,
  });
}

describe("McpServersScreen", () => {
  afterEach(() => {
    setColumns(undefined);
  });

  /** Renders McpServersScreen with mocked config and fixed terminal width. */
  function renderScreen(globalOverrides: Partial<Config> = {}) {
    setColumns(COLUMNS);
    const onBack = vi.fn();
    return {
      ...renderInk(<McpServersScreen onBack={onBack} />, {
        global: globalOverrides,
      }),
      onBack,
    };
  }

  describe("list view", () => {
    it("renders heading, borders, and key instructions", () => {
      const { lastFrame } = renderScreen();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("MCP Servers");
      expect(frame).toContain("Add server...");
      expect(frame).toContain("tab");
      expect(frame).toContain("options");
      expect(frame).toContain("back");
    });

    it("shows existing connections", () => {
      const { lastFrame } = renderScreen({
        mcp: {
          connections: {
            "my-server": {
              transport: "stdio",
              command: "node",
              args: ["server.mjs"],
              enabled: true,
            },
            "remote-api": {
              transport: "http",
              url: "https://example.com/mcp",
              enabled: true,
            },
          },
        },
      });
      const frame = lastFrame() ?? "";
      expect(frame).toContain("my-server");
      expect(frame).toContain("remote-api");
    });

    it("calls onBack on escape from the list", async () => {
      const { stdin, onBack } = renderScreen();
      await stdin.write(keys.escape);
      expect(onBack).toHaveBeenCalled();
    });
  });

  describe("adding a stdio server", () => {
    it("routes through transport pick into the options form", async () => {
      const { stdin, lastFrame } = renderScreen();
      await stdin.write("my-stdio");
      await stdin.write(keys.enter);
      // Now on transport-pick step
      let frame = lastFrame() ?? "";
      expect(frame).toContain("my-stdio");
      expect(frame).toContain("Transport");
      expect(frame).toContain("stdio");
      expect(frame).toContain("http");

      // stdio is the first option, just press enter
      await stdin.write(keys.enter);
      frame = lastFrame() ?? "";
      expect(frame).toContain("my-stdio (stdio)");
      expect(frame).toContain("Command:");
      expect(frame).toContain("Args:");
      expect(frame).toContain("Env: 0 entries");
    });

    it("does not persist anything until the form is submitted", async () => {
      const { stdin } = renderScreen();
      await stdin.write("srv");
      await stdin.write(keys.enter);
      await stdin.write(keys.enter); // pick stdio
      // Form is open but not submitted — config should be untouched.
      const config = loadConfig();
      expect(config.mcp.connections).toEqual({});
    });

    it("discards changes when the form is cancelled after transport pick", async () => {
      const { stdin } = renderScreen();
      await stdin.write("srv");
      await stdin.write(keys.enter);
      await stdin.write(keys.enter); // pick stdio
      await stdin.write("node");
      await stdin.write(keys.escape);
      const config = loadConfig();
      expect(config.mcp.connections).toEqual({});
    });

    it("saves edited form values back to config", async () => {
      const { stdin } = renderScreen();
      await stdin.write("srv");
      await stdin.write(keys.enter);
      await stdin.write(keys.enter); // pick stdio
      // On Command field — type the command
      await stdin.write("node");
      // Down to Args
      await stdin.write(keys.down);
      await stdin.write("server.mjs --port 9000");
      // Submit
      await stdin.write(keys.enter);
      const config = loadConfig();
      const conn = config.mcp.connections.srv;
      expect(conn.transport).toBe("stdio");
      if (conn.transport === "stdio") {
        expect(conn.command).toBe("node");
        expect(conn.args).toEqual(["server.mjs", "--port", "9000"]);
      }
    });
  });

  describe("adding an http server", () => {
    it("opens the http options form when http is picked", async () => {
      const { stdin, lastFrame } = renderScreen();
      await stdin.write("api");
      await stdin.write(keys.enter);
      // Move down to http
      await stdin.write(keys.down);
      await stdin.write(keys.enter);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("api (http)");
      expect(frame).toContain("URL:");
      expect(frame).toContain("Headers: 0 entries");
    });

    it("saves an http connection with a url", async () => {
      const { stdin } = renderScreen();
      await stdin.write("api");
      await stdin.write(keys.enter);
      await stdin.write(keys.down);
      await stdin.write(keys.enter); // pick http
      await stdin.write("https://example.com/mcp");
      await stdin.write(keys.enter);
      const config = loadConfig();
      const conn = config.mcp.connections.api;
      expect(conn.transport).toBe("http");
      if (conn.transport === "http") {
        expect(conn.url).toBe("https://example.com/mcp");
      }
    });
  });

  describe("editing an existing server", () => {
    function withExisting() {
      return renderScreen({
        mcp: {
          connections: {
            existing: {
              transport: "stdio",
              command: "node",
              args: ["server.mjs"],
              enabled: true,
            },
          },
        },
      });
    }

    it("opens the options form on tab", async () => {
      const { stdin, lastFrame } = withExisting();
      // Move up to the existing item
      await stdin.write(keys.up);
      await stdin.write(keys.tab);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("existing (stdio)");
      expect(frame).toContain("Command: node");
      expect(frame).toContain("Args: server.mjs");
    });

    it("saves edits back to the same connection key", async () => {
      const { stdin } = withExisting();
      await stdin.write(keys.up);
      await stdin.write(keys.tab);
      // Cursor on Command, append a suffix
      await stdin.write("-x");
      await stdin.write(keys.enter);
      const config = loadConfig();
      const conn = config.mcp.connections.existing;
      if (conn.transport === "stdio") {
        expect(conn.command).toBe("node-x");
      }
    });
  });

  describe("kv editor round-trip", () => {
    it("opens KvEditor on tab and merges changes back into the form", async () => {
      const { stdin, lastFrame } = renderScreen();
      await stdin.write("srv");
      await stdin.write(keys.enter);
      await stdin.write(keys.enter); // pick stdio
      // Type a command so we can check it's preserved across the round trip
      await stdin.write("node");
      // Move down to Args, then down to Env (the kv field)
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      // Tab into the kv editor
      await stdin.write(keys.tab);
      let frame = lastFrame() ?? "";
      expect(frame).toContain("srv — Env");
      expect(frame).toContain("KEY=value");

      // Add an entry
      await stdin.write("FOO=bar");
      await stdin.write(keys.enter);
      // Exit the editor
      await stdin.write(keys.escape);

      // Back in the form — Env should now show 1 entry, command preserved
      frame = lastFrame() ?? "";
      expect(frame).toContain("srv (stdio)");
      expect(frame).toContain("Command: node");
      expect(frame).toContain("Env: 1 entry");
    });

    it("persists kv editor changes when the form is saved", async () => {
      const { stdin } = renderScreen();
      await stdin.write("srv");
      await stdin.write(keys.enter);
      await stdin.write(keys.enter); // pick stdio
      await stdin.write("node");
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.tab);
      await stdin.write("API_KEY=secret");
      await stdin.write(keys.enter);
      await stdin.write(keys.escape);
      // Submit the form
      await stdin.write(keys.enter);
      const config = loadConfig();
      const conn = config.mcp.connections.srv;
      if (conn.transport === "stdio") {
        expect(conn.env).toEqual({ API_KEY: "secret" });
      }
    });

    it("supports headers for http connections", async () => {
      const { stdin } = renderScreen();
      await stdin.write("api");
      await stdin.write(keys.enter);
      await stdin.write(keys.down);
      await stdin.write(keys.enter); // pick http
      await stdin.write("https://example.com/mcp");
      // Down to Headers
      await stdin.write(keys.down);
      await stdin.write(keys.tab);
      await stdin.write("Authorization=Bearer xxx");
      await stdin.write(keys.enter);
      await stdin.write(keys.escape);
      await stdin.write(keys.enter);
      const config = loadConfig();
      const conn = config.mcp.connections.api;
      if (conn.transport === "http") {
        expect(conn.headers).toEqual({ Authorization: "Bearer xxx" });
      }
    });
  });

  describe("removing", () => {
    it("removes a connection on clear+enter", async () => {
      const { stdin } = renderScreen({
        mcp: {
          connections: {
            doomed: {
              transport: "stdio",
              command: "node",
              args: [],
              enabled: true,
            },
          },
        },
      });
      // Move up to the doomed item
      await stdin.write(keys.up);
      // Clear text by deleting the chars
      for (let i = 0; i < "doomed".length; i++) {
        await stdin.write(keys.delete);
      }
      await stdin.write(keys.enter);
      const config = loadConfig();
      expect(config.mcp.connections).toEqual({});
    });
  });

  describe("renaming", () => {
    it("renames a connection via inline edit", async () => {
      const { stdin } = renderScreen({
        mcp: {
          connections: {
            old: {
              transport: "stdio",
              command: "node",
              args: [],
              enabled: true,
            },
          },
        },
      });
      await stdin.write(keys.up);
      // Append "-renamed"
      await stdin.write("-renamed");
      await stdin.write(keys.enter);
      const config = loadConfig();
      expect(Object.keys(config.mcp.connections)).toEqual(["old-renamed"]);
    });
  });

  describe("cancelling", () => {
    it("returns to the list when escape is pressed in the form", async () => {
      const { stdin, lastFrame } = renderScreen();
      await stdin.write("srv");
      await stdin.write(keys.enter);
      await stdin.write(keys.enter); // pick stdio
      await stdin.write(keys.escape);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("MCP Servers");
      expect(frame).toContain("Add server...");
    });

    it("returns to the list when escape is pressed in the transport pick", async () => {
      const { stdin, lastFrame } = renderScreen();
      await stdin.write("srv");
      await stdin.write(keys.enter);
      await stdin.write(keys.escape);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("MCP Servers");
      expect(frame).toContain("Add server...");
    });
  });
});
