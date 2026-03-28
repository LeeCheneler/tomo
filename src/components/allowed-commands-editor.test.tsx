import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import { AllowedCommandsEditor } from "./allowed-commands-editor";
import type { SettingsState } from "./settings-selector";

const flush = () => new Promise((r) => setTimeout(r, 50));

const baseState: SettingsState = {
  toolAvailability: {},
  permissions: {},
  allowedCommands: ["git:*", "npm:*"],
  mcpServers: {},
};

function renderEditor(overrides?: {
  state?: Partial<SettingsState>;
  onUpdate?: (partial: Partial<SettingsState>) => void;
  onBack?: () => void;
}) {
  const onUpdate = overrides?.onUpdate ?? vi.fn();
  const onBack = overrides?.onBack ?? vi.fn();
  const result = render(
    <AllowedCommandsEditor
      state={{ ...baseState, ...overrides?.state }}
      onUpdate={onUpdate}
      onBack={onBack}
    />,
  );
  return { ...result, onUpdate, onBack };
}

describe("AllowedCommandsEditor", () => {
  it("shows commands and Add option", () => {
    const { lastFrame } = renderEditor();
    const output = lastFrame() ?? "";
    expect(output).toContain("git:*");
    expect(output).toContain("npm:*");
    expect(output).toContain("Add...");
  });

  it("deletes command with d", async () => {
    const onUpdate = vi.fn();
    const { stdin } = renderEditor({ onUpdate });

    stdin.write("d");
    await flush();

    expect(onUpdate).toHaveBeenCalledWith({
      allowedCommands: ["npm:*"],
    });
  });

  it("adds command", async () => {
    const onUpdate = vi.fn();
    const { stdin } = renderEditor({ onUpdate });

    // Navigate to Add row
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

    expect(onUpdate).toHaveBeenCalledWith({
      allowedCommands: ["git:*", "npm:*", "cargo:*"],
    });
  });

  it("adds with a shortcut", async () => {
    const onUpdate = vi.fn();
    const { stdin } = renderEditor({ onUpdate });

    stdin.write("a");
    await flush();
    stdin.write("yarn:*");
    await flush();
    stdin.write("\r");
    await flush();

    expect(onUpdate).toHaveBeenCalledWith({
      allowedCommands: ["git:*", "npm:*", "yarn:*"],
    });
  });

  it("cancels add with Esc", async () => {
    const onUpdate = vi.fn();
    const onBack = vi.fn();
    const { stdin } = renderEditor({ onUpdate, onBack });

    stdin.write("a");
    await flush();
    stdin.write("cargo");
    await flush();
    stdin.write("\x1B");
    await flush();

    expect(onUpdate).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
  });

  it("calls onBack on Esc", async () => {
    const onBack = vi.fn();
    const { stdin } = renderEditor({ onBack });

    stdin.write("\x1B");
    await flush();

    expect(onBack).toHaveBeenCalled();
  });

  it("calls onBack on q", async () => {
    const onBack = vi.fn();
    const { stdin } = renderEditor({ onBack });

    stdin.write("q");
    await flush();

    // q triggers add mode via 'a' check... actually q doesn't match 'a'
    expect(onBack).toHaveBeenCalled();
  });

  it("deduplicates commands", async () => {
    const onUpdate = vi.fn();
    const { stdin } = renderEditor({ onUpdate });

    stdin.write("a");
    await flush();
    stdin.write("git:*");
    await flush();
    stdin.write("\r");
    await flush();

    expect(onUpdate).not.toHaveBeenCalled();
  });
});
