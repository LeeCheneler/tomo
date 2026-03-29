import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import type { McpServerConfig } from "../config";
import { McpClient } from "../mcp/client";
import { McpServerSelector } from "./mcp-server-selector";
import type { SettingsState } from "./settings-selector";

vi.mock("../mcp/client", () => ({
  McpClient: vi.fn(),
}));
vi.mock("../mcp/http-transport", () => ({
  HttpTransport: vi.fn(),
}));
vi.mock("../mcp/stdio-transport", () => ({
  StdioTransport: vi.fn(),
}));

const flush = () => new Promise((r) => setTimeout(r, 50));

const defaultState: SettingsState = {
  toolAvailability: {},
  permissions: {},
  allowedCommands: [],
  mcpServers: {},
  skillSetSources: [],
};

function renderMcp(overrides?: {
  mcpServers?: Record<string, McpServerConfig>;
  failedServers?: Set<string>;
  onUpdate?: (partial: Partial<SettingsState>) => void;
  onBack?: () => void;
}) {
  const onUpdate = overrides?.onUpdate ?? vi.fn();
  const onBack = overrides?.onBack ?? vi.fn();
  const state = {
    ...defaultState,
    mcpServers: overrides?.mcpServers ?? {},
  };
  const result = render(
    <McpServerSelector
      state={state}
      onUpdate={onUpdate}
      failedServers={overrides?.failedServers}
      onBack={onBack}
    />,
  );
  return { ...result, onUpdate, onBack };
}

function setupMockClient(
  serverName: string,
  tools: { name: string; description?: string }[],
) {
  // biome-ignore lint/complexity/useArrowFunction: mockImplementation needs function for new
  vi.mocked(McpClient).mockImplementation(function () {
    return {
      initialize: vi.fn().mockResolvedValue({
        protocolVersion: "2025-03-26",
        capabilities: {},
        serverInfo: { name: serverName, version: "1.0.0" },
      }),
      listTools: vi.fn().mockResolvedValue(
        tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: {},
        })),
      ),
      close: vi.fn(),
    } as unknown as McpClient;
  });
}

describe("McpServerSelector", () => {
  describe("server list", () => {
    it("renders server list with Add option", () => {
      const { lastFrame } = renderMcp({
        mcpServers: {
          "my-server": {
            transport: "http",
            url: "https://mcp.example.com",
          },
        },
      });
      const output = lastFrame() ?? "";
      expect(output).toContain("my-server");
      expect(output).toContain("Add...");
    });

    it("calls onBack on Esc", async () => {
      const onBack = vi.fn();
      const { stdin } = renderMcp({ onBack });
      stdin.write("\x1B");
      await flush();
      expect(onBack).toHaveBeenCalled();
    });

    it("toggles server enabled with Space", async () => {
      const onUpdate = vi.fn();
      const { stdin } = renderMcp({
        mcpServers: {
          "my-server": {
            transport: "http",
            url: "https://mcp.example.com",
          },
        },
        onUpdate,
      });
      stdin.write(" ");
      await flush();
      expect(onUpdate).toHaveBeenCalledWith({
        mcpServers: expect.objectContaining({
          "my-server": expect.objectContaining({ enabled: false }),
        }),
      });
    });

    it("removes server with d", async () => {
      const onUpdate = vi.fn();
      const { stdin } = renderMcp({
        mcpServers: {
          "my-server": {
            transport: "http",
            url: "https://mcp.example.com",
          },
        },
        onUpdate,
      });
      stdin.write("d");
      await flush();
      expect(onUpdate).toHaveBeenCalledWith({ mcpServers: {} });
    });

    it("shows failed warning for disconnected servers", () => {
      const { lastFrame } = renderMcp({
        mcpServers: {
          broken: {
            transport: "http",
            url: "https://broken.example.com",
          },
        },
        failedServers: new Set(["broken"]),
      });
      expect(lastFrame()).toContain("Failed to connect");
    });

    it("opens server form on Enter", async () => {
      const { stdin, lastFrame } = renderMcp({
        mcpServers: {
          "my-server": {
            transport: "http",
            url: "https://mcp.example.com",
          },
        },
      });
      stdin.write("\r");
      await flush();
      expect(lastFrame()).toContain("my-server");
      expect(lastFrame()).toContain("URL:");
    });

    it("opens new server form on Add", async () => {
      const { stdin, lastFrame } = renderMcp();
      stdin.write("a");
      await flush();
      expect(lastFrame()).toContain("New Server");
      expect(lastFrame()).toContain("Type:");
    });
  });

  describe("server form", () => {
    it("shows transport type selector for new servers", async () => {
      const { stdin, lastFrame } = renderMcp();
      stdin.write("a");
      await flush();
      const output = lastFrame() ?? "";
      expect(output).toContain("Type:");
      expect(output).toContain("http");
      expect(output).toContain("stdio");
    });

    it("hides transport type for existing servers", async () => {
      const { stdin, lastFrame } = renderMcp({
        mcpServers: {
          "my-server": {
            transport: "http",
            url: "https://mcp.example.com",
          },
        },
      });
      stdin.write("\r");
      await flush();
      expect(lastFrame()).not.toContain("Type:");
    });

    it("toggles transport type with Space", async () => {
      const { stdin, lastFrame } = renderMcp();
      stdin.write("a");
      await flush();
      expect(lastFrame()).toContain("URL:");
      stdin.write(" ");
      await flush();
      expect(lastFrame()).toContain("Command:");
    });

    it("shows discard warning for new servers", async () => {
      const { stdin, lastFrame } = renderMcp();
      stdin.write("a");
      await flush();
      expect(lastFrame()).toContain("Leave without connecting to discard");
    });

    it("shows existing server connection details", async () => {
      const { stdin, lastFrame } = renderMcp({
        mcpServers: {
          "my-server": {
            transport: "http",
            url: "https://mcp.example.com",
            tools: [
              {
                name: "get_weather",
                enabled: true,
                description: "Get weather",
              },
            ],
          },
        },
      });
      stdin.write("\r");
      await flush();
      const output = lastFrame() ?? "";
      expect(output).toContain("mcp.example.com");
      expect(output).toContain("get_weather");
      expect(output).toContain("Reload tools");
    });

    it("shows Connect for servers without tools", async () => {
      const { stdin, lastFrame } = renderMcp();
      stdin.write("a");
      await flush();
      expect(lastFrame()).toContain("Connect");
    });

    it("toggles tool with Space", async () => {
      const onUpdate = vi.fn();
      const { stdin } = renderMcp({
        mcpServers: {
          "my-server": {
            transport: "http",
            url: "https://mcp.example.com",
            tools: [{ name: "tool_a", enabled: true }],
          },
        },
        onUpdate,
      });
      stdin.write("\r");
      await flush();
      // Navigate: connection (0) -> kv add (1) -> tool (2)
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write(" ");
      await flush();
      expect(onUpdate).toHaveBeenCalledWith({
        mcpServers: expect.objectContaining({
          "my-server": expect.objectContaining({
            tools: [{ name: "tool_a", enabled: false }],
          }),
        }),
      });
    });

    it("Esc from existing server saves and returns", async () => {
      const onUpdate = vi.fn();
      const { stdin, lastFrame } = renderMcp({
        mcpServers: {
          "my-server": {
            transport: "http",
            url: "https://mcp.example.com",
          },
        },
        onUpdate,
      });
      stdin.write("\r");
      await flush();
      stdin.write("\x1B");
      await flush();
      expect(lastFrame()).toContain("Add...");
      expect(onUpdate).toHaveBeenCalled();
    });

    it("Esc from new server discards without saving", async () => {
      const onUpdate = vi.fn();
      const { stdin, lastFrame } = renderMcp({ onUpdate });
      stdin.write("a");
      await flush();
      stdin.write("\x1B");
      await flush();
      expect(lastFrame()).toContain("Add...");
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });

  describe("inline key/value editing", () => {
    it("adds a kv pair with Add row", async () => {
      const { stdin, lastFrame } = renderMcp();
      stdin.write("a");
      await flush();
      // Navigate to kv Add: type (0) -> connection (1) -> kv add (2)
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\r");
      await flush();
      // Should have added a new item with sensitive, name, value rows
      expect(lastFrame()).toContain("Sensitive");
      expect(lastFrame()).toContain("Name:");
      expect(lastFrame()).toContain("Value:");
    });

    it("toggles sensitive flag with Space", async () => {
      const { stdin, lastFrame } = renderMcp();
      stdin.write("a");
      await flush();
      // Navigate to kv Add and add item
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\r");
      await flush();
      // Cursor lands on sensitive toggle — toggle it
      stdin.write(" ");
      await flush();
      expect(lastFrame()).toContain("[✔]");
    });

    it("deletes a kv pair with d", async () => {
      const { stdin, lastFrame } = renderMcp({
        mcpServers: {
          "my-server": {
            transport: "http",
            url: "https://mcp.example.com",
            headers: { Authorization: { value: "Bearer token" } },
          },
        },
      });
      stdin.write("\r");
      await flush();
      // Navigate to sensitive row of the header: connection (0) -> sensitive (1)
      stdin.write("\x1B[B");
      await flush();
      stdin.write("d");
      await flush();
      expect(lastFrame()).not.toContain("Authorization");
    });

    it("shows env vars for stdio servers", async () => {
      const { stdin, lastFrame } = renderMcp({
        mcpServers: {
          "my-server": {
            transport: "stdio",
            command: "node",
            args: ["server.js"],
            env: { DATABASE_URL: { value: "postgres://localhost" } },
          },
        },
      });
      stdin.write("\r");
      await flush();
      expect(lastFrame()).toContain("Environment Variables");
      expect(lastFrame()).toContain("DATABASE_URL");
    });

    it("edits kv name and value inline", async () => {
      const { stdin, lastFrame } = renderMcp();
      stdin.write("a");
      await flush();
      // Navigate to kv Add and add item
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\r");
      await flush();
      // Cursor on sensitive — move to key field
      stdin.write("\x1B[B");
      await flush();
      stdin.write("Authorization");
      await flush();
      expect(lastFrame()).toContain("Authorization");
      // Move to value field
      stdin.write("\x1B[B");
      await flush();
      stdin.write("Bearer my-token");
      await flush();
      expect(lastFrame()).toContain("Bearer my-token");
    });

    it("masks value when sensitive is toggled", async () => {
      const { stdin, lastFrame } = renderMcp();
      stdin.write("a");
      await flush();
      // Add kv item
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\r");
      await flush();
      // Cursor on sensitive — toggle on
      stdin.write(" ");
      await flush();
      // Go to value (sensitive -> key -> value)
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write("secret");
      await flush();
      const output = lastFrame() ?? "";
      expect(output).not.toContain("secret");
      expect(output).toContain("******");
    });

    it("loads existing headers as editable kv items", async () => {
      const { stdin, lastFrame } = renderMcp({
        mcpServers: {
          "my-server": {
            transport: "http",
            url: "https://mcp.example.com",
            headers: {
              Authorization: { value: "Bearer token" },
              "X-Custom": { value: "value" },
            },
          },
        },
      });
      stdin.write("\r");
      await flush();
      const output = lastFrame() ?? "";
      expect(output).toContain("Authorization");
      expect(output).toContain("X-Custom");
      expect(output).toContain("Sensitive");
    });

    it("d on kv name/value row types the letter", async () => {
      const { stdin, lastFrame } = renderMcp();
      stdin.write("a");
      await flush();
      // Add a kv item
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\r");
      await flush();
      // Cursor on sensitive — move to key field
      stdin.write("\x1B[B");
      await flush();
      // Type "d"
      stdin.write("d");
      await flush();
      // Should have typed "d", not deleted
      expect(lastFrame()).toContain("Sensitive");
      expect(lastFrame()).toContain("Name:");
    });

    it("switching transport type clears kv and tools", async () => {
      const { stdin, lastFrame } = renderMcp();
      stdin.write("a");
      await flush();
      // Add a kv item: type (0) -> connection (1) -> kv add (2)
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\r");
      await flush();
      // Cursor on sensitive (2) — move to key (3) and type
      stdin.write("\x1B[B");
      await flush();
      stdin.write("Authorization");
      await flush();
      expect(lastFrame()).toContain("Authorization");
      // Navigate back to type row: key (3) -> sensitive (2) -> connection (1) -> type (0)
      stdin.write("\x1B[A");
      await flush();
      stdin.write("\x1B[A");
      await flush();
      stdin.write("\x1B[A");
      await flush();
      stdin.write(" ");
      await flush();
      // KV item should be gone
      expect(lastFrame()).not.toContain("Authorization");
      expect(lastFrame()).toContain("Command:");
    });
  });

  describe("connect flow", () => {
    it("connects new server and discovers tools", async () => {
      setupMockClient("weather-server", [
        { name: "get_weather", description: "Get weather data" },
      ]);
      const onUpdate = vi.fn();
      const { stdin } = renderMcp({ onUpdate });

      stdin.write("a");
      await flush();
      // Navigate to connection and type URL
      stdin.write("\x1B[B");
      await flush();
      stdin.write("mcp.example.com");
      await flush();
      // Navigate to Connect: connection (1) -> kv add (2) -> connect (3)
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write(" ");
      await flush();
      await flush();
      await flush();

      expect(onUpdate).toHaveBeenCalledWith({
        mcpServers: expect.objectContaining({
          "weather-server": expect.objectContaining({
            transport: "http",
            url: "https://mcp.example.com",
            tools: [
              {
                name: "get_weather",
                enabled: true,
                description: "Get weather data",
              },
            ],
          }),
        }),
      });
    });

    it("connects stdio server", async () => {
      setupMockClient("stdio-server", [{ name: "run_script" }]);
      const onUpdate = vi.fn();
      const { stdin } = renderMcp({ onUpdate });

      stdin.write("a");
      await flush();
      // Switch to stdio
      stdin.write(" ");
      await flush();
      // Navigate to command
      stdin.write("\x1B[B");
      await flush();
      stdin.write("node server.js --port 3000");
      await flush();
      // Navigate to Connect
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write(" ");
      await flush();
      await flush();
      await flush();

      expect(onUpdate).toHaveBeenCalledWith({
        mcpServers: expect.objectContaining({
          "stdio-server": expect.objectContaining({
            transport: "stdio",
            command: "node",
            args: ["server.js", "--port", "3000"],
          }),
        }),
      });
    });

    it("shows error on connection failure", async () => {
      // biome-ignore lint/complexity/useArrowFunction: mockImplementation needs function for new
      vi.mocked(McpClient).mockImplementation(function () {
        return {
          initialize: vi
            .fn()
            .mockRejectedValue(new Error("Connection refused")),
          close: vi.fn(),
        } as unknown as McpClient;
      });

      const { stdin, lastFrame } = renderMcp();
      stdin.write("a");
      await flush();
      // Navigate to Connect: type (0) -> connection (1) -> kv add (2) -> connect (3)
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write(" ");
      await flush();
      await flush();
      await flush();

      expect(lastFrame()).toContain("Connection refused");
    });

    it("preserves tool enabled state on reload", async () => {
      setupMockClient("my-server", [{ name: "tool_a" }, { name: "tool_b" }]);
      const onUpdate = vi.fn();
      const { stdin, lastFrame } = renderMcp({
        mcpServers: {
          "my-server": {
            transport: "http",
            url: "https://mcp.example.com",
            tools: [
              { name: "tool_a", enabled: false },
              { name: "tool_b", enabled: true },
            ],
          },
        },
        onUpdate,
      });

      stdin.write("\r");
      await flush();
      // Navigate to Reload: connection (0) -> kv add (1) -> tool_a (2) -> tool_b (3) -> reload (4)
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write(" ");
      await flush();
      await flush();
      await flush();

      // tool_a should still be disabled after reload
      const output = lastFrame() ?? "";
      expect(output).toContain("tool_a");
      expect(output).toContain("tool_b");
    });

    it("saves sensitive flag in header config", async () => {
      setupMockClient("test-server", [{ name: "tool_1" }]);
      const onUpdate = vi.fn();
      const { stdin } = renderMcp({ onUpdate });

      stdin.write("a");
      await flush();
      // Add a kv item: type (0) -> connection (1) -> kv add (2)
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\r");
      await flush();
      // Cursor on sensitive — toggle on
      stdin.write(" ");
      await flush();
      // Go to key and type name
      stdin.write("\x1B[B");
      await flush();
      stdin.write("Authorization");
      await flush();
      // Go to value
      stdin.write("\x1B[B");
      await flush();
      stdin.write("Bearer secret");
      await flush();
      // Navigate to Connect: value -> kv add -> connect
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write(" ");
      await flush();
      await flush();
      await flush();

      expect(onUpdate).toHaveBeenCalledWith({
        mcpServers: expect.objectContaining({
          "test-server": expect.objectContaining({
            headers: {
              Authorization: { value: "Bearer secret", sensitive: true },
            },
          }),
        }),
      });
    });

    it("appends suffix when server name exists", async () => {
      setupMockClient("my-server", []);
      const onUpdate = vi.fn();
      const { stdin } = renderMcp({
        mcpServers: {
          "my-server": { transport: "http", url: "https://existing.com" },
        },
        onUpdate,
      });

      stdin.write("a");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write("new.example.com");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write(" ");
      await flush();
      await flush();
      await flush();

      expect(onUpdate).toHaveBeenCalledWith({
        mcpServers: expect.objectContaining({
          "my-server": expect.anything(),
          "my-server-2": expect.objectContaining({ transport: "http" }),
        }),
      });
    });
  });
});
