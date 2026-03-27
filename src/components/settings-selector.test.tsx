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
  onSave?: (...args: unknown[]) => void;
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
