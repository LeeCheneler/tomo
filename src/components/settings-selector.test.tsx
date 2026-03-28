import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import { SettingsSelector } from "./settings-selector";

const flush = () => new Promise((r) => setTimeout(r, 50));

const defaultTools = ["read_file", "write_file", "run_command"];

const defaultToolAvailability: Record<string, boolean> = {
  read_file: true,
  write_file: true,
  run_command: true,
};

const defaultPermissions = {
  read_file: true,
  write_file: false,
};

const defaultAllowedCommands = ["git:*", "npm:*"];

function renderSettings(overrides?: {
  tools?: string[];
  toolAvailability?: Record<string, boolean>;
  toolWarnings?: Record<string, string>;
  permissions?: Record<string, boolean>;
  allowedCommands?: string[];
  mcpServers?: Record<string, import("../config").McpServerConfig>;
  onSave?: (...args: unknown[]) => void;
  onAddMcpServer?: (...args: unknown[]) => void;
  onRemoveMcpServer?: (...args: unknown[]) => void;
  onToggleMcpServer?: (...args: unknown[]) => void;
  onCancel?: () => void;
}) {
  const onSave = overrides?.onSave ?? vi.fn();
  const onCancel = overrides?.onCancel ?? vi.fn();
  const result = render(
    <SettingsSelector
      tools={overrides?.tools ?? defaultTools}
      currentToolAvailability={
        overrides?.toolAvailability ?? defaultToolAvailability
      }
      toolWarnings={overrides?.toolWarnings}
      currentPermissions={overrides?.permissions ?? defaultPermissions}
      currentAllowedCommands={
        overrides?.allowedCommands ?? defaultAllowedCommands
      }
      onSave={onSave}
      onAddMcpServer={overrides?.onAddMcpServer ?? vi.fn()}
      onRemoveMcpServer={overrides?.onRemoveMcpServer ?? vi.fn()}
      onToggleMcpServer={overrides?.onToggleMcpServer ?? vi.fn()}
      mcpServers={overrides?.mcpServers ?? {}}
      onCancel={onCancel}
    />,
  );
  return { ...result, onSave, onCancel };
}

describe("SettingsSelector", () => {
  describe("menu", () => {
    it("renders menu options", () => {
      const { lastFrame } = renderSettings();
      const output = lastFrame();
      expect(output).toContain("Tool Availability");
      expect(output).toContain("Tool Permissions");
      expect(output).toContain("Allowed Commands");
    });

    it("saves on Esc from menu", async () => {
      const onSave = vi.fn();
      const { stdin } = renderSettings({ onSave });

      stdin.write("\x1B");
      await flush();

      expect(onSave).toHaveBeenCalledWith(
        defaultToolAvailability,
        defaultPermissions,
        defaultAllowedCommands,
      );
    });

    it("cancels on q from menu", async () => {
      const onCancel = vi.fn();
      const { stdin } = renderSettings({ onCancel });

      stdin.write("q");
      await flush();

      expect(onCancel).toHaveBeenCalled();
    });
  });

  describe("tool availability", () => {
    it("shows tools after selecting the step", async () => {
      const { stdin, lastFrame } = renderSettings();

      stdin.write("\r");
      await flush();

      const output = lastFrame();
      expect(output).toContain("read_file");
      expect(output).toContain("run_command");
    });

    it("toggles tool availability", async () => {
      const onSave = vi.fn();
      const { stdin } = renderSettings({ onSave });

      stdin.write("\r");
      await flush();
      stdin.write(" ");
      await flush();
      stdin.write("\x1B");
      await flush();
      stdin.write("\x1B");
      await flush();

      const savedTools = onSave.mock.calls[0][0];
      expect(savedTools.read_file).toBe(false);
    });
  });

  describe("tool permissions", () => {
    it("shows permissions after selecting the step", async () => {
      const { stdin, lastFrame } = renderSettings();

      stdin.write("\x1B[B");
      await flush();
      stdin.write("\r");
      await flush();

      const output = lastFrame();
      expect(output).toContain("Read File");
      expect(output).toContain("Write File");
    });

    it("toggles permission", async () => {
      const onSave = vi.fn();
      const { stdin } = renderSettings({ onSave });

      stdin.write("\x1B[B");
      await flush();
      stdin.write("\r");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write(" ");
      await flush();
      stdin.write("\x1B");
      await flush();
      stdin.write("\x1B");
      await flush();

      const savedPerms = onSave.mock.calls[0][1];
      expect(savedPerms.write_file).toBe(true);
    });
  });

  describe("allowed commands", () => {
    it("shows allowed commands after selecting the step", async () => {
      const { stdin, lastFrame } = renderSettings();

      // Down twice to Allowed Commands
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\r");
      await flush();

      const output = lastFrame();
      expect(output).toContain("git:*");
      expect(output).toContain("npm:*");
      expect(output).toContain("Add...");
    });

    it("deletes allowed command", async () => {
      const onSave = vi.fn();
      const { stdin } = renderSettings({ onSave });

      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\r");
      await flush();
      stdin.write("d");
      await flush();
      stdin.write("\x1B");
      await flush();
      stdin.write("\x1B");
      await flush();

      const savedAllowed = onSave.mock.calls[0][2];
      expect(savedAllowed).toHaveLength(1);
      expect(savedAllowed[0]).toBe("npm:*");
    });

    it("adds new entry", async () => {
      const onSave = vi.fn();
      const { stdin } = renderSettings({ onSave });

      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\r");
      await flush();
      // Move to add row (2 entries, add is index 2)
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\r");
      await flush();
      stdin.write("cargo:*");
      await flush();
      stdin.write("\r");
      await flush();
      stdin.write("\x1B");
      await flush();
      stdin.write("\x1B");
      await flush();

      const savedAllowed = onSave.mock.calls[0][2];
      expect(savedAllowed).toHaveLength(3);
      expect(savedAllowed[2]).toBe("cargo:*");
    });

    it("adds exact command", async () => {
      const onSave = vi.fn();
      const { stdin } = renderSettings({ onSave });

      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\r");
      await flush();
      stdin.write("a");
      await flush();
      stdin.write("npm test");
      await flush();
      stdin.write("\r");
      await flush();
      stdin.write("\x1B");
      await flush();
      stdin.write("\x1B");
      await flush();

      const savedAllowed = onSave.mock.calls[0][2];
      expect(savedAllowed).toContain("npm test");
    });

    it("cancels add with Escape", async () => {
      const onSave = vi.fn();
      const { stdin } = renderSettings({ onSave });

      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\r");
      await flush();
      stdin.write("a");
      await flush();
      stdin.write("cargo");
      await flush();
      stdin.write("\x1B");
      await flush();
      stdin.write("\x1B");
      await flush();
      stdin.write("\x1B");
      await flush();

      const savedAllowed = onSave.mock.calls[0][2];
      expect(savedAllowed).toHaveLength(2);
    });
  });

  describe("MCP servers", () => {
    it("renders MCP Servers menu option", () => {
      const { lastFrame } = renderSettings();
      expect(lastFrame()).toContain("MCP Servers");
    });

    it("shows MCP server list after selecting the step", async () => {
      const { stdin, lastFrame } = renderSettings({
        mcpServers: {
          "test-server": {
            transport: "http",
            url: "https://mcp.example.com",
          },
        },
      });

      // Down 3 times to MCP Servers, then Enter
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\r");
      await flush();

      const output = lastFrame();
      expect(output).toContain("test-server");
      expect(output).toContain("Add...");
    });

    it("toggles MCP server enabled state", async () => {
      const onToggle = vi.fn();
      const { stdin } = renderSettings({
        mcpServers: {
          "my-server": {
            transport: "http",
            url: "https://mcp.example.com",
          },
        },
        onToggleMcpServer: onToggle,
      });

      // Navigate to MCP Servers
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\r");
      await flush();

      // Toggle server
      stdin.write(" ");
      await flush();

      expect(onToggle).toHaveBeenCalledWith("my-server", false);
    });

    it("removes MCP server and its tools from availability", async () => {
      const onRemove = vi.fn();
      const onSave = vi.fn();
      const { stdin } = renderSettings({
        mcpServers: {
          "my-server": {
            transport: "http",
            url: "https://mcp.example.com",
          },
        },
        toolAvailability: {
          ...defaultToolAvailability,
          "mcp__my-server__tool_a": true,
          "mcp__my-server__tool_b": false,
        },
        onRemoveMcpServer: onRemove,
        onSave,
      });

      // Navigate to MCP Servers
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\r");
      await flush();

      // Delete server
      stdin.write("d");
      await flush();

      expect(onRemove).toHaveBeenCalledWith("my-server");

      // Go back to menu and save
      stdin.write("\x1B");
      await flush();
      stdin.write("\x1B");
      await flush();

      const savedTools = onSave.mock.calls[0][0];
      expect(savedTools["mcp__my-server__tool_a"]).toBeUndefined();
      expect(savedTools["mcp__my-server__tool_b"]).toBeUndefined();
      expect(savedTools.read_file).toBe(true);
    });

    it("shows MCP tools in tool availability list", async () => {
      const { stdin, lastFrame } = renderSettings({
        toolAvailability: {
          ...defaultToolAvailability,
          "mcp__my-server__get_weather": true,
          "mcp__my-server__random_number": false,
        },
      });

      // Navigate to Tool Availability
      stdin.write("\r");
      await flush();

      const output = lastFrame() ?? "";
      expect(output).toContain("my-server");
      expect(output).toContain("get_weather");
      expect(output).toContain("random_number");
    });
  });

  describe("navigation", () => {
    it("returns to menu with Esc from a step", async () => {
      const { stdin, lastFrame } = renderSettings();

      stdin.write("\r");
      await flush();
      expect(lastFrame()).toContain("Tool Availability");

      stdin.write("\x1B");
      await flush();
      expect(lastFrame()).toContain("Settings");
    });

    it("returns to menu with q from a step", async () => {
      const { stdin, lastFrame } = renderSettings();

      stdin.write("\r");
      await flush();
      stdin.write("q");
      await flush();
      expect(lastFrame()).toContain("Settings");
    });
  });
});
