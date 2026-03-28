import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import type { SettingsState } from "./settings-selector";
import { ToolPermissionsEditor } from "./tool-permissions-editor";

const flush = () => new Promise((r) => setTimeout(r, 50));

const baseState: SettingsState = {
  toolAvailability: {},
  permissions: { read_file: true, write_file: false },
  allowedCommands: [],
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
    <ToolPermissionsEditor
      state={{ ...baseState, ...overrides?.state }}
      onUpdate={onUpdate}
      onBack={onBack}
    />,
  );
  return { ...result, onUpdate, onBack };
}

describe("ToolPermissionsEditor", () => {
  it("shows permission rows", () => {
    const { lastFrame } = renderEditor();
    const output = lastFrame() ?? "";
    expect(output).toContain("Read File");
    expect(output).toContain("Write File");
    expect(output).toContain("Tomo only");
  });

  it("toggles permission", async () => {
    const onUpdate = vi.fn();
    const { stdin } = renderEditor({ onUpdate });

    // Navigate to Write File and toggle
    stdin.write("\x1B[B");
    await flush();
    stdin.write(" ");
    await flush();

    expect(onUpdate).toHaveBeenCalledWith({
      permissions: expect.objectContaining({ write_file: true }),
    });
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

    expect(onBack).toHaveBeenCalled();
  });
});
