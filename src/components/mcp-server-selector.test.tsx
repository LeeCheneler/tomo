import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import type { McpServerConfig } from "../config";
import { McpServerSelector } from "./mcp-server-selector";

const flush = () => new Promise((r) => setTimeout(r, 50));

function renderMcp(overrides?: {
  servers?: Record<string, McpServerConfig>;
  failedServers?: Set<string>;
  onAddServer?: (...args: unknown[]) => void;
  onRemoveServer?: (...args: unknown[]) => void;
  onToggleServer?: (...args: unknown[]) => void;
  onUpdateTools?: (...args: unknown[]) => void;
  onBack?: () => void;
}) {
  const onBack = overrides?.onBack ?? vi.fn();
  const result = render(
    <McpServerSelector
      servers={overrides?.servers ?? {}}
      failedServers={overrides?.failedServers}
      onAddServer={overrides?.onAddServer ?? vi.fn()}
      onRemoveServer={overrides?.onRemoveServer ?? vi.fn()}
      onToggleServer={overrides?.onToggleServer ?? vi.fn()}
      onUpdateTools={overrides?.onUpdateTools ?? vi.fn()}
      onBack={onBack}
    />,
  );
  return { ...result, onBack };
}

describe("McpServerSelector", () => {
  describe("server list", () => {
    it("renders server list with Add option", () => {
      const { lastFrame } = renderMcp({
        servers: {
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

    it("calls onBack on Esc from server list", async () => {
      const onBack = vi.fn();
      const { stdin } = renderMcp({ onBack });

      stdin.write("\x1B");
      await flush();

      expect(onBack).toHaveBeenCalled();
    });

    it("calls onBack on q from server list", async () => {
      const onBack = vi.fn();
      const { stdin } = renderMcp({ onBack });

      stdin.write("q");
      await flush();

      expect(onBack).toHaveBeenCalled();
    });

    it("toggles server enabled with Space", async () => {
      const onToggle = vi.fn();
      const { stdin } = renderMcp({
        servers: {
          "my-server": {
            transport: "http",
            url: "https://mcp.example.com",
          },
        },
        onToggleServer: onToggle,
      });

      stdin.write(" ");
      await flush();

      expect(onToggle).toHaveBeenCalledWith("my-server", false);
    });

    it("removes server with d", async () => {
      const onRemove = vi.fn();
      const { stdin } = renderMcp({
        servers: {
          "my-server": {
            transport: "http",
            url: "https://mcp.example.com",
          },
        },
        onRemoveServer: onRemove,
      });

      stdin.write("d");
      await flush();

      expect(onRemove).toHaveBeenCalledWith("my-server");
    });

    it("shows failed warning for disconnected servers", () => {
      const { lastFrame } = renderMcp({
        servers: {
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
        servers: {
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
        servers: {
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
        servers: {
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
      const onUpdateTools = vi.fn();
      const { stdin } = renderMcp({
        servers: {
          "my-server": {
            transport: "http",
            url: "https://mcp.example.com",
            tools: [{ name: "get_weather", enabled: true }],
          },
        },
        onUpdateTools,
      });

      // Enter to open tools
      stdin.write("\r");
      await flush();

      // Space to toggle
      stdin.write(" ");
      await flush();

      expect(onUpdateTools).toHaveBeenCalledWith("my-server", [
        { name: "get_weather", enabled: false },
      ]);
    });

    it("returns to server list on Esc", async () => {
      const { stdin, lastFrame } = renderMcp({
        servers: {
          "my-server": {
            transport: "http",
            url: "https://mcp.example.com",
            tools: [{ name: "get_weather", enabled: true }],
          },
        },
      });

      // Enter to open tools
      stdin.write("\r");
      await flush();
      expect(lastFrame()).toContain("get_weather");

      // Esc to go back
      stdin.write("\x1B");
      await flush();
      expect(lastFrame()).toContain("my-server");
      expect(lastFrame()).toContain("Add...");
    });

    it("shows empty message when no tools", async () => {
      const { stdin, lastFrame } = renderMcp({
        servers: {
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

      // Cursor starts on Add (only item)
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

      // Select http (first option)
      stdin.write("\r");
      await flush();

      const output = lastFrame() ?? "";
      expect(output).toContain("Enter server URL");
    });

    it("navigates to command input for stdio", async () => {
      const { stdin, lastFrame } = renderMcp();

      stdin.write("\r");
      await flush();

      // Down to stdio, Enter
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\r");
      await flush();

      const output = lastFrame() ?? "";
      expect(output).toContain("Enter command");
    });

    it("returns to server list on Esc from add steps", async () => {
      const { stdin, lastFrame } = renderMcp();

      // Go to add type
      stdin.write("\r");
      await flush();
      expect(lastFrame()).toContain("http");

      // Esc back
      stdin.write("\x1B");
      await flush();
      expect(lastFrame()).toContain("Add...");
    });
  });

  describe("navigation", () => {
    it("navigates between servers with arrow keys", async () => {
      const { stdin, lastFrame } = renderMcp({
        servers: {
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

      // First server should be highlighted
      let output = lastFrame() ?? "";
      expect(output).toContain("❯");

      // Down to second
      stdin.write("\x1B[B");
      await flush();

      output = lastFrame() ?? "";
      expect(output).toContain("server-b");
    });
  });
});
