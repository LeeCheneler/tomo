import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import type { McpServerConfig } from "../config";
import { McpServerSelector } from "./mcp-server-selector";
import type { SettingsState } from "./settings-selector";

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
});
