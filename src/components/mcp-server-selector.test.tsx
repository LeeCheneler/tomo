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

    it("shows empty list with just Add option", () => {
      const { lastFrame } = renderMcp();
      const output = lastFrame() ?? "";
      expect(output).toContain("Add...");
    });

    it("calls onBack on Esc", async () => {
      const onBack = vi.fn();
      const { stdin } = renderMcp({ onBack });

      stdin.write("\x1B");
      await flush();

      expect(onBack).toHaveBeenCalled();
    });

    it("calls onBack on q", async () => {
      const onBack = vi.fn();
      const { stdin } = renderMcp({ onBack });

      stdin.write("q");
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

      expect(onUpdate).toHaveBeenCalledWith({
        mcpServers: {},
      });
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

      const output = lastFrame() ?? "";
      expect(output).toContain("Failed to connect");
    });

    it("shows transport info in server description", () => {
      const { lastFrame } = renderMcp({
        mcpServers: {
          "http-server": {
            transport: "http",
            url: "https://mcp.example.com",
          },
        },
      });

      const output = lastFrame() ?? "";
      expect(output).toContain("http");
      expect(output).toContain("https://mcp.example.com");
    });
  });

  describe("server tools", () => {
    it("shows tool list on Enter", async () => {
      const { stdin, lastFrame } = renderMcp({
        mcpServers: {
          "my-server": {
            transport: "http",
            url: "https://mcp.example.com",
            tools: [
              { name: "get_weather", enabled: true },
              { name: "random_number", enabled: false },
            ],
          },
        },
      });

      stdin.write("\r");
      await flush();

      const output = lastFrame() ?? "";
      expect(output).toContain("my-server");
      expect(output).toContain("get_weather");
      expect(output).toContain("random_number");
    });

    it("shows tool descriptions when available", async () => {
      const { stdin, lastFrame } = renderMcp({
        mcpServers: {
          "my-server": {
            transport: "http",
            url: "https://mcp.example.com",
            tools: [
              {
                name: "get_weather",
                enabled: true,
                description: "Returns weather data",
              },
            ],
          },
        },
      });

      stdin.write("\r");
      await flush();

      const output = lastFrame() ?? "";
      expect(output).toContain("Returns weather data");
    });

    it("toggles tool enabled with Space", async () => {
      const onUpdate = vi.fn();
      const { stdin } = renderMcp({
        mcpServers: {
          "my-server": {
            transport: "http",
            url: "https://mcp.example.com",
            tools: [{ name: "get_weather", enabled: true }],
          },
        },
        onUpdate,
      });

      stdin.write("\r");
      await flush();
      stdin.write(" ");
      await flush();

      expect(onUpdate).toHaveBeenCalledWith({
        mcpServers: expect.objectContaining({
          "my-server": expect.objectContaining({
            tools: [{ name: "get_weather", enabled: false }],
          }),
        }),
      });
    });

    it("returns to server list on Esc", async () => {
      const { stdin, lastFrame } = renderMcp({
        mcpServers: {
          "my-server": {
            transport: "http",
            url: "https://mcp.example.com",
            tools: [{ name: "get_weather", enabled: true }],
          },
        },
      });

      stdin.write("\r");
      await flush();
      expect(lastFrame()).toContain("get_weather");

      stdin.write("\x1B");
      await flush();
      expect(lastFrame()).toContain("my-server");
      expect(lastFrame()).toContain("Add...");
    });

    it("shows empty message when no tools", async () => {
      const { stdin, lastFrame } = renderMcp({
        mcpServers: {
          "my-server": {
            transport: "http",
            url: "https://mcp.example.com",
            tools: [],
          },
        },
      });

      stdin.write("\r");
      await flush();

      const output = lastFrame() ?? "";
      expect(output).toContain("No tools discovered");
    });
  });

  describe("add flow", () => {
    it("navigates to transport type selection on Add", async () => {
      const { stdin, lastFrame } = renderMcp();

      stdin.write("\r");
      await flush();

      const output = lastFrame() ?? "";
      expect(output).toContain("http");
      expect(output).toContain("stdio");
    });

    it("navigates to URL input for http", async () => {
      const { stdin, lastFrame } = renderMcp();

      stdin.write("\r");
      await flush();
      stdin.write("\r");
      await flush();

      const output = lastFrame() ?? "";
      expect(output).toContain("Enter server URL");
    });

    it("navigates to command input for stdio", async () => {
      const { stdin, lastFrame } = renderMcp();

      stdin.write("\r");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\r");
      await flush();

      const output = lastFrame() ?? "";
      expect(output).toContain("Enter command");
    });

    it("returns to server list on Esc from add steps", async () => {
      const { stdin, lastFrame } = renderMcp();

      stdin.write("\r");
      await flush();
      expect(lastFrame()).toContain("http");

      stdin.write("\x1B");
      await flush();
      expect(lastFrame()).toContain("Add...");
    });
  });

  describe("navigation", () => {
    it("navigates between servers with arrow keys", async () => {
      const { stdin, lastFrame } = renderMcp({
        mcpServers: {
          "server-a": {
            transport: "http",
            url: "https://a.example.com",
          },
          "server-b": {
            transport: "http",
            url: "https://b.example.com",
          },
        },
      });

      let output = lastFrame() ?? "";
      expect(output).toContain("❯");

      stdin.write("\x1B[B");
      await flush();

      output = lastFrame() ?? "";
      expect(output).toContain("server-b");
    });
  });

  describe("connect flow", () => {
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

    it("connects to HTTP server and saves discovered tools", async () => {
      setupMockClient("weather-server", [
        { name: "get_weather", description: "Get weather data" },
      ]);
      const onUpdate = vi.fn();
      const { stdin } = renderMcp({ onUpdate });

      // Navigate: Add → http → enter URL (pre-filled with "https://") → submit
      stdin.write("\r"); // select "Add..."
      await flush();
      stdin.write("\r"); // select "http"
      await flush();
      stdin.write("mcp.example.com"); // "https://" is pre-filled
      await flush();
      stdin.write("\r"); // submit URL
      await flush();
      stdin.write("\r"); // confirm headers (none)
      await flush();
      await flush(); // extra flush for async connect
      await flush();

      expect(onUpdate).toHaveBeenCalledWith({
        mcpServers: {
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
        },
      });
    });

    it("appends suffix when server name already exists", async () => {
      setupMockClient("my-server", []);
      const onUpdate = vi.fn();
      const { stdin } = renderMcp({
        mcpServers: {
          "my-server": { transport: "http", url: "https://existing.com" },
        },
        onUpdate,
      });

      // Navigate down to "Add..." (past existing server)
      stdin.write("\x1B[B"); // arrow down
      await flush();
      stdin.write("\r"); // select "Add..."
      await flush();
      stdin.write("\r"); // select "http"
      await flush();
      stdin.write("mcp2.example.com"); // "https://" is pre-filled
      await flush();
      stdin.write("\r"); // submit URL
      await flush();
      stdin.write("\r"); // confirm headers (none)
      await flush();
      await flush();
      await flush();

      expect(onUpdate).toHaveBeenCalledWith({
        mcpServers: expect.objectContaining({
          "my-server": expect.anything(),
          "my-server-2": expect.objectContaining({
            transport: "http",
            url: "https://mcp2.example.com",
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

      stdin.write("\r"); // Add
      await flush();
      stdin.write("\r"); // http
      await flush();
      stdin.write("bad.example.com"); // "https://" is pre-filled
      await flush();
      stdin.write("\r"); // submit URL
      await flush();
      stdin.write("\r"); // confirm headers (none)
      await flush();
      await flush();
      await flush();

      const output = lastFrame() ?? "";
      expect(output).toContain("Connection refused");
    });

    it("connects to stdio server", async () => {
      setupMockClient("stdio-server", [{ name: "run_script" }]);
      const onUpdate = vi.fn();
      const { stdin } = renderMcp({ onUpdate });

      stdin.write("\r"); // Add
      await flush();
      stdin.write("\x1B[B"); // arrow down to stdio
      await flush();
      stdin.write("\r"); // select stdio
      await flush();
      stdin.write("node server.js --port 3000");
      await flush();
      stdin.write("\r"); // submit
      await flush();
      await flush();
      await flush();

      expect(onUpdate).toHaveBeenCalledWith({
        mcpServers: {
          "stdio-server": expect.objectContaining({
            transport: "stdio",
            command: "node",
            args: ["server.js", "--port", "3000"],
            tools: [
              { name: "run_script", enabled: true, description: undefined },
            ],
          }),
        },
      });
    });

    it("shows header configurator after URL entry", async () => {
      const { stdin, lastFrame } = renderMcp();

      stdin.write("\r"); // Add
      await flush();
      stdin.write("\r"); // http
      await flush();
      stdin.write("mcp.example.com");
      await flush();
      stdin.write("\r"); // submit URL
      await flush();

      const output = lastFrame() ?? "";
      expect(output).toContain("Headers");
      expect(output).toContain("a add");
      expect(output).toContain("No headers configured");
      // biome-ignore lint/suspicious/noTemplateCurlyInString: testing literal output
      expect(output).toContain("${VAR}");
    });

    it("adds a header via key/value prompts", async () => {
      const { stdin, lastFrame } = renderMcp();

      stdin.write("\r"); // Add
      await flush();
      stdin.write("\r"); // http
      await flush();
      stdin.write("mcp.example.com");
      await flush();
      stdin.write("\r"); // submit URL
      await flush();
      // Now on addHeaders — press 'a' to add
      stdin.write("a");
      await flush();
      expect(lastFrame()).toContain("Enter header name");
      stdin.write("Authorization");
      await flush();
      stdin.write("\r"); // submit key
      await flush();
      expect(lastFrame()).toContain("Enter value for Authorization");
      stdin.write("Bearer my-secret");
      await flush();
      stdin.write("\r"); // submit value
      await flush();

      // Back on addHeaders — should show the header
      const output = lastFrame() ?? "";
      expect(output).toContain("Authorization");
      expect(output).not.toContain("Bearer my-secret");
      expect(output).toContain("****************");
    });

    it("stores headers from configurator", async () => {
      setupMockClient("auth-server", []);
      const onUpdate = vi.fn();
      const { stdin } = renderMcp({ onUpdate });

      stdin.write("\r"); // Add
      await flush();
      stdin.write("\r"); // http
      await flush();
      stdin.write("mcp.example.com");
      await flush();
      stdin.write("\r"); // submit URL
      await flush();
      // Add a header
      stdin.write("a");
      await flush();
      stdin.write("X-API-Key");
      await flush();
      stdin.write("\r"); // submit key
      await flush();
      stdin.write("secret-123");
      await flush();
      stdin.write("\r"); // submit value
      await flush();
      // Confirm headers
      stdin.write("\r");
      await flush();
      await flush();
      await flush();

      expect(onUpdate).toHaveBeenCalledWith({
        mcpServers: {
          "auth-server": expect.objectContaining({
            transport: "http",
            url: "https://mcp.example.com",
            headers: { "X-API-Key": "secret-123" },
          }),
        },
      });
    });

    it("stores multiple headers", async () => {
      setupMockClient("multi-header-server", []);
      const onUpdate = vi.fn();
      const { stdin } = renderMcp({ onUpdate });

      stdin.write("\r"); // Add
      await flush();
      stdin.write("\r"); // http
      await flush();
      stdin.write("mcp.example.com");
      await flush();
      stdin.write("\r"); // submit URL
      await flush();
      // Add first header
      stdin.write("a");
      await flush();
      stdin.write("Authorization");
      await flush();
      stdin.write("\r");
      await flush();
      stdin.write("Bearer token1");
      await flush();
      stdin.write("\r");
      await flush();
      // Add second header
      stdin.write("a");
      await flush();
      stdin.write("X-Custom");
      await flush();
      stdin.write("\r");
      await flush();
      stdin.write("custom-value");
      await flush();
      stdin.write("\r");
      await flush();
      // Confirm
      stdin.write("\r");
      await flush();
      await flush();
      await flush();

      expect(onUpdate).toHaveBeenCalledWith({
        mcpServers: {
          "multi-header-server": expect.objectContaining({
            headers: {
              Authorization: "Bearer token1",
              "X-Custom": "custom-value",
            },
          }),
        },
      });
    });

    it("deletes a header with d", async () => {
      const { stdin, lastFrame } = renderMcp();

      stdin.write("\r"); // Add
      await flush();
      stdin.write("\r"); // http
      await flush();
      stdin.write("mcp.example.com");
      await flush();
      stdin.write("\r"); // submit URL
      await flush();
      // Add a header
      stdin.write("a");
      await flush();
      stdin.write("Authorization");
      await flush();
      stdin.write("\r");
      await flush();
      stdin.write("Bearer token");
      await flush();
      stdin.write("\r");
      await flush();
      expect(lastFrame()).toContain("Authorization");
      // Delete it
      stdin.write("d");
      await flush();
      expect(lastFrame()).toContain("No headers configured");
    });

    it("edits an existing header value with e", async () => {
      const { stdin, lastFrame } = renderMcp();

      stdin.write("\r"); // Add
      await flush();
      stdin.write("\r"); // http
      await flush();
      stdin.write("mcp.example.com");
      await flush();
      stdin.write("\r"); // submit URL
      await flush();
      // Add a header
      stdin.write("a");
      await flush();
      stdin.write("Authorization");
      await flush();
      stdin.write("\r");
      await flush();
      stdin.write("old-value");
      await flush();
      stdin.write("\r");
      await flush();
      expect(lastFrame()).toContain("Authorization");
      // Edit it — press e, clear old value, type new
      stdin.write("e");
      await flush();
      expect(lastFrame()).toContain("Enter value for Authorization");
      // Clear pre-filled value with backspace
      for (let i = 0; i < "old-value".length; i++) {
        stdin.write("\x7f");
        await flush();
      }
      stdin.write("new-value");
      await flush();
      stdin.write("\r");
      await flush();
      // Back on addHeaders — value length should match "new-value" (9 asterisks)
      const output = lastFrame() ?? "";
      expect(output).toContain("Authorization");
      expect(output).toContain("*********");
    });

    it("edits headers on an existing server with e from server list", async () => {
      const onUpdate = vi.fn();
      const { stdin, lastFrame } = renderMcp({
        mcpServers: {
          "my-server": {
            transport: "http",
            url: "https://mcp.example.com",
            headers: { Authorization: "Bearer old-token" },
            tools: [{ name: "tool1", enabled: true }],
          },
        },
        onUpdate,
      });

      // Press e to edit headers
      stdin.write("e");
      await flush();
      expect(lastFrame()).toContain("Headers");
      expect(lastFrame()).toContain("Authorization");
      // Add a new header
      stdin.write("a");
      await flush();
      stdin.write("X-Custom");
      await flush();
      stdin.write("\r");
      await flush();
      stdin.write("custom-val");
      await flush();
      stdin.write("\r");
      await flush();
      // Confirm
      stdin.write("\r");
      await flush();

      expect(onUpdate).toHaveBeenCalledWith({
        mcpServers: expect.objectContaining({
          "my-server": expect.objectContaining({
            transport: "http",
            url: "https://mcp.example.com",
            headers: {
              Authorization: "Bearer old-token",
              "X-Custom": "custom-val",
            },
          }),
        }),
      });
    });

    it("removes all headers from an existing server", async () => {
      const onUpdate = vi.fn();
      const { stdin } = renderMcp({
        mcpServers: {
          "my-server": {
            transport: "http",
            url: "https://mcp.example.com",
            headers: { Authorization: "Bearer old-token" },
          },
        },
        onUpdate,
      });

      // Press e to edit headers
      stdin.write("e");
      await flush();
      // Delete the header
      stdin.write("d");
      await flush();
      // Confirm (empty headers)
      stdin.write("\r");
      await flush();

      const config = onUpdate.mock.calls[0][0].mcpServers["my-server"];
      expect(config.headers).toBeUndefined();
      // Ensure the key isn't present at all
      expect("headers" in config).toBe(false);
    });

    it("skips headers when none are added", async () => {
      setupMockClient("no-auth-server", []);
      const onUpdate = vi.fn();
      const { stdin } = renderMcp({ onUpdate });

      stdin.write("\r"); // Add
      await flush();
      stdin.write("\r"); // http
      await flush();
      stdin.write("mcp.example.com");
      await flush();
      stdin.write("\r"); // submit URL
      await flush();
      stdin.write("\r"); // confirm headers (none)
      await flush();
      await flush();
      await flush();

      const config = onUpdate.mock.calls[0][0].mcpServers["no-auth-server"];
      expect(config.headers).toBeUndefined();
    });
  });
});
