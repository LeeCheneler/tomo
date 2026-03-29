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
  skillSetSources: [],
  enabledSkillSets: [],
};

function renderSettings(overrides?: {
  state?: Partial<SettingsState>;
  toolMeta?: Partial<ToolMeta>;
  onSave?: (state: SettingsState) => void;
}) {
  const onSave = overrides?.onSave ?? vi.fn();
  const result = render(
    <SettingsSelector
      initialState={{ ...defaultState, ...overrides?.state }}
      toolMeta={{ ...defaultToolMeta, ...overrides?.toolMeta }}
      onSave={onSave}
    />,
  );
  return { ...result, onSave };
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
      stdin.write("a");
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
  });
});
