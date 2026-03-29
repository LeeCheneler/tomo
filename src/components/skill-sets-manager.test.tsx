import { render } from "ink-testing-library";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SettingsState } from "./settings-selector";
import { SkillSetsManager } from "./skill-sets-manager";

vi.mock("../skill-sets/sources", () => ({
  cloneSource: vi.fn(),
  discoverSkillSets: vi.fn(),
}));

import { cloneSource, discoverSkillSets } from "../skill-sets/sources";

const mockCloneSource = vi.mocked(cloneSource);
const mockDiscoverSkillSets = vi.mocked(discoverSkillSets);

const flush = () => new Promise((r) => setTimeout(r, 50));

const baseState: SettingsState = {
  toolAvailability: {},
  permissions: {},
  allowedCommands: [],
  mcpServers: {},
  skillSetSources: [{ url: "git@github.com:org/skills.git" }],
  enabledSkillSets: [],
};

function renderManager(overrides?: {
  state?: Partial<SettingsState>;
  onUpdate?: (partial: Partial<SettingsState>) => void;
  onBack?: () => void;
}) {
  const onUpdate = overrides?.onUpdate ?? vi.fn();
  const onBack = overrides?.onBack ?? vi.fn();
  const result = render(
    <SkillSetsManager
      state={{ ...baseState, ...overrides?.state }}
      onUpdate={onUpdate}
      onBack={onBack}
    />,
  );
  return { ...result, onUpdate, onBack };
}

describe("SkillSetsManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCloneSource.mockReturnValue("/tmp/cloned");
    mockDiscoverSkillSets.mockReturnValue([
      {
        name: "dev",
        description: "Dev tools",
        path: "/tmp/cloned/dev",
        sourceUrl: "git@github.com:org/skills.git",
      },
    ]);
  });

  it("shows discovered skill sets", async () => {
    const { lastFrame } = renderManager();
    await flush();

    const output = lastFrame() ?? "";
    expect(output).toContain("dev");
    expect(output).toContain("Dev tools");
    expect(output).toContain("Manage Sources...");
  });

  it("shows skill sets as unchecked by default", async () => {
    const { lastFrame } = renderManager();
    await flush();

    const output = lastFrame() ?? "";
    expect(output).toContain("[ ]");
    expect(output).not.toContain("[✔]");
  });

  it("shows skill sets as checked when enabled", async () => {
    const { lastFrame } = renderManager({
      state: {
        enabledSkillSets: [
          { sourceUrl: "git@github.com:org/skills.git", name: "dev" },
        ],
      },
    });
    await flush();

    const output = lastFrame() ?? "";
    expect(output).toContain("[✔]");
  });

  it("toggles a skill set on with space", async () => {
    const onUpdate = vi.fn();
    const { stdin } = renderManager({ onUpdate });
    await flush();

    stdin.write(" ");
    await flush();

    expect(onUpdate).toHaveBeenCalledWith({
      enabledSkillSets: [
        { sourceUrl: "git@github.com:org/skills.git", name: "dev" },
      ],
    });
  });

  it("toggles a skill set off with space", async () => {
    const onUpdate = vi.fn();
    const { stdin } = renderManager({
      state: {
        enabledSkillSets: [
          { sourceUrl: "git@github.com:org/skills.git", name: "dev" },
        ],
      },
      onUpdate,
    });
    await flush();

    stdin.write(" ");
    await flush();

    expect(onUpdate).toHaveBeenCalledWith({
      enabledSkillSets: [],
    });
  });

  it("calls onBack on Esc", async () => {
    const onBack = vi.fn();
    const { stdin } = renderManager({ onBack });
    await flush();

    stdin.write("\x1B");
    await flush();

    expect(onBack).toHaveBeenCalled();
  });

  it("navigates to sources editor on Enter at Manage Sources", async () => {
    const { stdin, lastFrame } = renderManager();
    await flush();

    // Navigate down to "Manage Sources..."
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\r");
    await flush();

    const output = lastFrame() ?? "";
    expect(output).toContain("Skill Set Sources");
  });

  it("shows empty state when no sources configured", async () => {
    mockDiscoverSkillSets.mockReturnValue([]);
    const { lastFrame } = renderManager({
      state: { skillSetSources: [] },
    });
    await flush();

    const output = lastFrame() ?? "";
    expect(output).toContain("No skill sets found");
  });

  it("shows warning for failed clone and still renders UI", async () => {
    mockCloneSource.mockImplementation(() => {
      throw new Error("clone failed");
    });
    mockDiscoverSkillSets.mockReturnValue([]);

    const { lastFrame } = renderManager();
    await flush();

    const output = lastFrame() ?? "";
    expect(output).toContain("⚠ Failed to clone");
    expect(output).toContain("git@github.com:org/skills.git");
    expect(output).toContain("Manage Sources...");
  });

  it("shows <no description> when description is empty", async () => {
    mockDiscoverSkillSets.mockReturnValue([
      {
        name: "ops",
        description: "",
        path: "/tmp/cloned/ops",
        sourceUrl: "git@github.com:org/skills.git",
      },
    ]);

    const { lastFrame } = renderManager();
    await flush();

    const output = lastFrame() ?? "";
    expect(output).toContain("<no description>");
  });

  it("shows multiple skill sets from multiple sources", async () => {
    mockDiscoverSkillSets.mockReturnValue([
      {
        name: "dev",
        description: "Dev tools",
        path: "/tmp/cloned/dev",
        sourceUrl: "git@github.com:org/skills.git",
      },
      {
        name: "design",
        description: "Design tools",
        path: "/tmp/cloned/design",
        sourceUrl: "git@github.com:org/skills.git",
      },
    ]);

    const { lastFrame } = renderManager();
    await flush();

    const output = lastFrame() ?? "";
    expect(output).toContain("dev");
    expect(output).toContain("design");
  });
});
