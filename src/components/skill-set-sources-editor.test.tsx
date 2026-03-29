import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import type { SettingsState } from "./settings-selector";
import { SkillSetSourcesEditor } from "./skill-set-sources-editor";

const flush = () => new Promise((r) => setTimeout(r, 50));

const baseState: SettingsState = {
  toolAvailability: {},
  permissions: {},
  allowedCommands: [],
  mcpServers: {},
  skillSetSources: [
    { url: "https://github.com/org/skills-a.git" },
    { url: "https://github.com/org/skills-b.git" },
  ],
};

function renderEditor(overrides?: {
  state?: Partial<SettingsState>;
  onUpdate?: (partial: Partial<SettingsState>) => void;
  onBack?: () => void;
}) {
  const onUpdate = overrides?.onUpdate ?? vi.fn();
  const onBack = overrides?.onBack ?? vi.fn();
  const result = render(
    <SkillSetSourcesEditor
      state={{ ...baseState, ...overrides?.state }}
      onUpdate={onUpdate}
      onBack={onBack}
    />,
  );
  return { ...result, onUpdate, onBack };
}

describe("SkillSetSourcesEditor", () => {
  it("shows sources and Add option", () => {
    const { lastFrame } = renderEditor();
    const output = lastFrame() ?? "";
    expect(output).toContain("skills-a.git");
    expect(output).toContain("skills-b.git");
    expect(output).toContain("Add...");
  });

  it("deletes source with d", async () => {
    const onUpdate = vi.fn();
    const { stdin } = renderEditor({ onUpdate });

    stdin.write("d");
    await flush();

    expect(onUpdate).toHaveBeenCalledWith({
      skillSetSources: [{ url: "https://github.com/org/skills-b.git" }],
    });
  });

  it("adds source", async () => {
    const onUpdate = vi.fn();
    const { stdin } = renderEditor({ onUpdate });

    stdin.write("a");
    await flush();
    stdin.write("https://github.com/org/skills-c.git");
    await flush();
    stdin.write("\r");
    await flush();

    expect(onUpdate).toHaveBeenCalledWith({
      skillSetSources: [
        { url: "https://github.com/org/skills-a.git" },
        { url: "https://github.com/org/skills-b.git" },
        { url: "https://github.com/org/skills-c.git" },
      ],
    });
  });

  it("Enter on Add row starts add mode", async () => {
    const onUpdate = vi.fn();
    const { stdin } = renderEditor({ onUpdate });

    // Navigate to Add row
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\r");
    await flush();
    stdin.write("https://github.com/org/skills-c.git");
    await flush();
    stdin.write("\r");
    await flush();

    expect(onUpdate).toHaveBeenCalledWith({
      skillSetSources: [
        { url: "https://github.com/org/skills-a.git" },
        { url: "https://github.com/org/skills-b.git" },
        { url: "https://github.com/org/skills-c.git" },
      ],
    });
  });

  it("Space on Add row starts add mode", async () => {
    const onUpdate = vi.fn();
    const { stdin } = renderEditor({ onUpdate });

    // Navigate to Add row
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\x1B[B");
    await flush();
    stdin.write(" ");
    await flush();
    stdin.write("https://github.com/org/skills-c.git");
    await flush();
    stdin.write("\r");
    await flush();

    expect(onUpdate).toHaveBeenCalledWith({
      skillSetSources: [
        { url: "https://github.com/org/skills-a.git" },
        { url: "https://github.com/org/skills-b.git" },
        { url: "https://github.com/org/skills-c.git" },
      ],
    });
  });

  it("cancels add with Esc", async () => {
    const onUpdate = vi.fn();
    const onBack = vi.fn();
    const { stdin } = renderEditor({ onUpdate, onBack });

    stdin.write("a");
    await flush();
    stdin.write("https://github.com/org/skills-c.git");
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

  it("deduplicates sources", async () => {
    const onUpdate = vi.fn();
    const { stdin } = renderEditor({ onUpdate });

    stdin.write("a");
    await flush();
    stdin.write("https://github.com/org/skills-a.git");
    await flush();
    stdin.write("\r");
    await flush();

    expect(onUpdate).not.toHaveBeenCalled();
  });
});
