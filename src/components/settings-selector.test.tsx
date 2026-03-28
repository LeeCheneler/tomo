import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import type { SettingsState, ToolMeta } from "./settings-selector";
import { SettingsSelector } from "./settings-selector";

const flush = () => new Promise((r) => setTimeout(r, 50));

const defaultToolMeta: ToolMeta = {
  names: ["read_file", "write_file", "run_command"],
  displayNames: {
    read_file: "Read File",
    write_file: "Write File",
    run_command: "Run Command",
  },
  descriptions: {},
  warnings: {},
};

const defaultState: SettingsState = {
  toolAvailability: {
    read_file: true,
    write_file: true,
    run_command: true,
  },
  permissions: {
    read_file: true,
    write_file: false,
  },
  allowedCommands: ["git:*", "npm:*"],
  mcpServers: {},
};

function renderSettings(overrides?: {
  state?: Partial<SettingsState>;
  toolMeta?: Partial<ToolMeta>;
  onSave?: (state: SettingsState) => void;
  onCancel?: () => void;
}) {
  const onSave = overrides?.onSave ?? vi.fn();
  const onCancel = overrides?.onCancel ?? vi.fn();
  const result = render(
    <SettingsSelector
      initialState={{ ...defaultState, ...overrides?.state }}
      toolMeta={{ ...defaultToolMeta, ...overrides?.toolMeta }}
      onSave={onSave}
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
      expect(output).toContain("MCP Servers");
    });

    it("saves on Esc from menu", async () => {
      const onSave = vi.fn();
      const { stdin } = renderSettings({ onSave });

      stdin.write("\x1B");
      await flush();

      expect(onSave).toHaveBeenCalledWith(defaultState);
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
      expect(output).toContain("Read File");
      expect(output).toContain("Run Command");
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

      const saved = onSave.mock.calls[0][0] as SettingsState;
      expect(saved.toolAvailability.read_file).toBe(false);
    });

    it("shows MCP tools grouped by server", async () => {
      const { stdin, lastFrame } = renderSettings({
        state: {
          mcpServers: {
            "weather-api": {
              transport: "http",
              url: "https://mcp.example.com",
              tools: [
                {
                  name: "get_weather",
                  enabled: true,
                  description: "Returns weather data",
                },
                { name: "random_number", enabled: false },
              ],
            },
          },
        },
      });

      stdin.write("\r");
      await flush();

      const output = lastFrame() ?? "";
      expect(output).toContain("MCP → weather-api");
      expect(output).toContain("get_weather");
      expect(output).toContain("Returns weather data");
      expect(output).toContain("random_number");
    });

    it("toggles MCP tool from tool availability", async () => {
      const onSave = vi.fn();
      const { stdin } = renderSettings({
        state: {
          mcpServers: {
            "my-server": {
              transport: "http",
              url: "https://mcp.example.com",
              tools: [{ name: "tool_a", enabled: true }],
            },
          },
        },
        onSave,
      });

      stdin.write("\r");
      await flush();
      // Navigate past 3 built-in tools to MCP tool
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write("\x1B[B");
      await flush();
      stdin.write(" ");
      await flush();
      stdin.write("\x1B");
      await flush();
      stdin.write("\x1B");
      await flush();

      const saved = onSave.mock.calls[0][0] as SettingsState;
      expect(saved.mcpServers["my-server"].tools?.[0].enabled).toBe(false);
    });

    it("hides tools from disabled servers", async () => {
      const { stdin, lastFrame } = renderSettings({
        state: {
          mcpServers: {
            disabled: {
              transport: "http",
              url: "https://mcp.example.com",
              enabled: false,
              tools: [{ name: "hidden", enabled: true }],
            },
          },
        },
      });

      stdin.write("\r");
      await flush();

      const output = lastFrame() ?? "";
      expect(output).not.toContain("disabled");
      expect(output).not.toContain("hidden");
    });

    it("shows both built-in and MCP tools", async () => {
      const { stdin, lastFrame } = renderSettings({
        state: {
          mcpServers: {
            "test-server": {
              transport: "http",
              url: "https://mcp.example.com",
              tools: [{ name: "test_tool", enabled: true }],
            },
          },
        },
      });

      stdin.write("\r");
      await flush();

      const output = lastFrame() ?? "";
      expect(output).toContain("Read File");
      expect(output).toContain("MCP → test-server");
      expect(output).toContain("test_tool");
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

      const saved = onSave.mock.calls[0][0] as SettingsState;
      expect(saved.permissions.write_file).toBe(true);
    });
  });

  describe("allowed commands", () => {
    it("shows allowed commands after selecting the step", async () => {
      const { stdin, lastFrame } = renderSettings();

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

      const saved = onSave.mock.calls[0][0] as SettingsState;
      expect(saved.allowedCommands).toEqual(["npm:*"]);
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

      const saved = onSave.mock.calls[0][0] as SettingsState;
      expect(saved.allowedCommands).toContain("cargo:*");
    });
  });

  describe("MCP servers", () => {
    it("renders MCP Servers menu option", () => {
      const { lastFrame } = renderSettings();
      expect(lastFrame()).toContain("MCP Servers");
    });

    it("shows server list after selecting", async () => {
      const { stdin, lastFrame } = renderSettings({
        state: {
          mcpServers: {
            "test-server": {
              transport: "http",
              url: "https://mcp.example.com",
            },
          },
        },
      });

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
      const onSave = vi.fn();
      const { stdin } = renderSettings({
        state: {
          mcpServers: {
            "my-server": {
              transport: "http",
              url: "https://mcp.example.com",
            },
          },
        },
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

      // Toggle
      stdin.write(" ");
      await flush();

      // Back and save
      stdin.write("\x1B");
      await flush();
      stdin.write("\x1B");
      await flush();

      const saved = onSave.mock.calls[0][0] as SettingsState;
      expect(saved.mcpServers["my-server"].enabled).toBe(false);
    });

    it("removes MCP server", async () => {
      const onSave = vi.fn();
      const { stdin } = renderSettings({
        state: {
          mcpServers: {
            "my-server": {
              transport: "http",
              url: "https://mcp.example.com",
            },
          },
        },
        onSave,
      });

      stdin.write("\x1B[B");
      await flush();
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

      const saved = onSave.mock.calls[0][0] as SettingsState;
      expect(saved.mcpServers["my-server"]).toBeUndefined();
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
