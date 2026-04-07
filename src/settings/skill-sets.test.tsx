import { afterEach, describe, expect, it, vi } from "vitest";
import { loadConfig } from "../config/file";
import { renderInk } from "../test-utils/ink";
import { keys } from "../test-utils/keys";
import { SkillSetsScreen } from "./skill-sets";

vi.mock("../skill-sets/git", () => ({
  cloneSource: vi.fn(),
  pullSource: vi.fn(),
  removeSource: vi.fn(),
}));

vi.mock("../skill-sets/loader", () => ({
  discoverSkillSets: vi.fn(() => []),
}));

// Re-import after mocking so we can control return values.
const { cloneSource, pullSource, removeSource } = await import(
  "../skill-sets/git"
);
const { discoverSkillSets } = await import("../skill-sets/loader");

const COLUMNS = 40;

/** Override process.stdout.columns for test predictability. */
function setColumns(width: number | undefined) {
  Object.defineProperty(process.stdout, "columns", {
    value: width,
    writable: true,
    configurable: true,
  });
}

describe("SkillSetsScreen", () => {
  afterEach(() => {
    setColumns(undefined);
    vi.mocked(cloneSource).mockReset();
    vi.mocked(pullSource).mockReset();
    vi.mocked(removeSource).mockReset();
    vi.mocked(discoverSkillSets).mockReset();
  });

  /** Renders SkillSetsScreen with mocked config and fixed terminal width. */
  function renderSkillSets(globalOverrides: Record<string, unknown> = {}) {
    setColumns(COLUMNS);
    const onBack = vi.fn();
    return {
      ...renderInk(<SkillSetsScreen onBack={onBack} />, {
        global: globalOverrides,
      }),
      onBack,
    };
  }

  describe("rendering", () => {
    it("renders heading, borders, and help text", () => {
      const { lastFrame } = renderSkillSets();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Skill Sets");
      expect(frame).toContain("git repo URLs");
      expect(frame).toContain("Add source...");
      expect(frame).toContain("─".repeat(COLUMNS));
    });

    it("shows existing sources", () => {
      const { lastFrame } = renderSkillSets({
        skillSets: {
          sources: [{ url: "git@github.com:org/skills.git", enabledSets: [] }],
        },
      });
      expect(lastFrame()).toContain("git@github.com:org/skills.git");
    });

    it("shows key instructions", () => {
      const { lastFrame } = renderSkillSets();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("save");
      expect(frame).toContain("options");
      expect(frame).toContain("back");
    });
  });

  describe("adding a source", () => {
    it("persists a new source and clones the repo", async () => {
      const { stdin } = renderSkillSets();
      await stdin.write("git@github.com:org/new.git");
      await stdin.write(keys.enter);
      const config = loadConfig();
      expect(config.skillSets.sources).toHaveLength(1);
      expect(config.skillSets.sources[0].url).toBe(
        "git@github.com:org/new.git",
      );
      expect(cloneSource).toHaveBeenCalledWith("git@github.com:org/new.git");
    });

    it("shows error when clone fails and does not persist to config", async () => {
      vi.mocked(cloneSource).mockImplementation(() => {
        throw new Error("network error");
      });
      const { stdin, lastFrame } = renderSkillSets();
      await stdin.write("git@github.com:org/bad.git");
      await stdin.write(keys.enter);
      expect(lastFrame()).toContain("Failed to clone");
      const config = loadConfig();
      expect(config.skillSets.sources).toHaveLength(0);
    });
  });

  describe("removing a source", () => {
    it("removes source from config and deletes the clone", async () => {
      const { stdin } = renderSkillSets({
        skillSets: {
          sources: [{ url: "git@github.com:org/skills.git", enabledSets: [] }],
        },
      });
      // Navigate to the source (down from add row wraps to item 0)
      await stdin.write(keys.down);
      // Clear the URL text then enter to remove
      for (let i = 0; i < "git@github.com:org/skills.git".length; i++) {
        await stdin.write(keys.backspace);
      }
      await stdin.write(keys.enter);
      const config = loadConfig();
      expect(config.skillSets.sources).toHaveLength(0);
      expect(removeSource).toHaveBeenCalledWith(
        "git@github.com:org/skills.git",
      );
    });
  });

  describe("editing a source", () => {
    it("updates the URL, removes old clone, and clones new", async () => {
      const { stdin, lastFrame } = renderSkillSets({
        skillSets: {
          sources: [{ url: "git@github.com:org/old.git", enabledSets: [] }],
        },
      });
      await stdin.write(keys.down);
      // Clear old URL
      for (let i = 0; i < "git@github.com:org/old.git".length; i++) {
        await stdin.write(keys.backspace);
      }
      await stdin.write("git@github.com:org/new.git");
      await stdin.write(keys.enter);
      expect(removeSource).toHaveBeenCalledWith("git@github.com:org/old.git");
      expect(cloneSource).toHaveBeenCalledWith("git@github.com:org/new.git");
      expect(lastFrame()).toContain("Cloned");
    });

    it("preserves other sources when editing", async () => {
      const { stdin } = renderSkillSets({
        skillSets: {
          sources: [
            { url: "git@github.com:org/first.git", enabledSets: [] },
            { url: "git@github.com:org/second.git", enabledSets: ["dev"] },
          ],
        },
      });
      // Navigate to first source
      await stdin.write(keys.down);
      for (let i = 0; i < "git@github.com:org/first.git".length; i++) {
        await stdin.write(keys.backspace);
      }
      await stdin.write("git@github.com:org/new.git");
      await stdin.write(keys.enter);
      const config = loadConfig();
      expect(config.skillSets.sources).toHaveLength(2);
      // Original second source preserved with its enabledSets
      const second = config.skillSets.sources.find(
        (s) => s.url === "git@github.com:org/second.git",
      );
      expect(second?.enabledSets).toEqual(["dev"]);
    });

    it("shows error when clone fails after edit and preserves original source", async () => {
      vi.mocked(cloneSource).mockImplementation(() => {
        throw new Error("fail");
      });
      const { stdin, lastFrame } = renderSkillSets({
        skillSets: {
          sources: [{ url: "git@github.com:org/old.git", enabledSets: [] }],
        },
      });
      await stdin.write(keys.down);
      for (let i = 0; i < "git@github.com:org/old.git".length; i++) {
        await stdin.write(keys.backspace);
      }
      await stdin.write("git@github.com:org/new.git");
      await stdin.write(keys.enter);
      expect(lastFrame()).toContain("Failed to clone");
      const config = loadConfig();
      expect(config.skillSets.sources).toHaveLength(1);
      expect(config.skillSets.sources[0].url).toBe(
        "git@github.com:org/old.git",
      );
    });
  });

  describe("options screen", () => {
    it("shows set name only when no description", async () => {
      vi.mocked(discoverSkillSets).mockReturnValue([
        {
          name: "ops",
          description: "",
          path: "/repo/ops",
          sourceUrl: "git@github.com:org/skills.git",
        },
      ]);
      const { stdin, lastFrame } = renderSkillSets({
        skillSets: {
          sources: [{ url: "git@github.com:org/skills.git", enabledSets: [] }],
        },
      });
      await stdin.write(keys.down);
      await stdin.write(keys.tab);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("ops");
      expect(frame).not.toContain("—");
    });

    it("shows discovered sets as toggleable items", async () => {
      vi.mocked(discoverSkillSets).mockReturnValue([
        {
          name: "dev",
          description: "Dev tools",
          path: "/repo/dev",
          sourceUrl: "git@github.com:org/skills.git",
        },
      ]);
      const { stdin, lastFrame } = renderSkillSets({
        skillSets: {
          sources: [{ url: "git@github.com:org/skills.git", enabledSets: [] }],
        },
      });
      // Navigate to source and open options
      await stdin.write(keys.down);
      await stdin.write(keys.tab);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("dev");
      expect(frame).toContain("Dev tools");
    });

    it("shows message when no sets found", async () => {
      vi.mocked(discoverSkillSets).mockReturnValue([]);
      const { stdin, lastFrame } = renderSkillSets({
        skillSets: {
          sources: [{ url: "git@github.com:org/skills.git", enabledSets: [] }],
        },
      });
      await stdin.write(keys.down);
      await stdin.write(keys.tab);
      expect(lastFrame()).toContain("No skill sets found");
    });

    it("preserves other sources when toggling a set", async () => {
      vi.mocked(discoverSkillSets).mockReturnValue([
        {
          name: "dev",
          description: "Dev tools",
          path: "/repo/dev",
          sourceUrl: "git@github.com:org/skills.git",
        },
      ]);
      const { stdin } = renderSkillSets({
        skillSets: {
          sources: [
            { url: "git@github.com:org/skills.git", enabledSets: [] },
            { url: "git@github.com:org/other.git", enabledSets: ["ops"] },
          ],
        },
      });
      // Navigate to first source and open options
      await stdin.write(keys.down);
      await stdin.write(keys.tab);
      await stdin.write(keys.space);
      const config = loadConfig();
      expect(config.skillSets.sources[0].enabledSets).toContain("dev");
      expect(config.skillSets.sources[1].enabledSets).toEqual(["ops"]);
    });

    it("toggles a set on and persists to config", async () => {
      vi.mocked(discoverSkillSets).mockReturnValue([
        {
          name: "dev",
          description: "Dev tools",
          path: "/repo/dev",
          sourceUrl: "git@github.com:org/skills.git",
        },
      ]);
      const { stdin, getConfig } = renderSkillSets({
        skillSets: {
          sources: [{ url: "git@github.com:org/skills.git", enabledSets: [] }],
        },
      });
      await stdin.write(keys.down);
      await stdin.write(keys.tab);
      // Space toggles the set
      await stdin.write(keys.space);
      const config = loadConfig();
      expect(config.skillSets.sources[0].enabledSets).toContain("dev");
      expect(getConfig().skillSets.sources[0].enabledSets).toContain("dev");
    });

    it("toggles a set off and persists to config", async () => {
      vi.mocked(discoverSkillSets).mockReturnValue([
        {
          name: "dev",
          description: "Dev tools",
          path: "/repo/dev",
          sourceUrl: "git@github.com:org/skills.git",
        },
      ]);
      const { stdin } = renderSkillSets({
        skillSets: {
          sources: [
            { url: "git@github.com:org/skills.git", enabledSets: ["dev"] },
          ],
        },
      });
      await stdin.write(keys.down);
      await stdin.write(keys.tab);
      await stdin.write(keys.space);
      const config = loadConfig();
      expect(config.skillSets.sources[0].enabledSets).not.toContain("dev");
    });

    it("pulls latest on u key and shows success", async () => {
      vi.mocked(discoverSkillSets).mockReturnValue([]);
      const { stdin, lastFrame } = renderSkillSets({
        skillSets: {
          sources: [{ url: "git@github.com:org/skills.git", enabledSets: [] }],
        },
      });
      await stdin.write(keys.down);
      await stdin.write(keys.tab);
      await stdin.write("u");
      expect(pullSource).toHaveBeenCalledWith("git@github.com:org/skills.git");
      expect(lastFrame()).toContain("Updated");
    });

    it("shows error when pull fails", async () => {
      vi.mocked(discoverSkillSets).mockReturnValue([]);
      vi.mocked(pullSource).mockImplementation(() => {
        throw new Error("network error");
      });
      const { stdin, lastFrame } = renderSkillSets({
        skillSets: {
          sources: [{ url: "git@github.com:org/skills.git", enabledSets: [] }],
        },
      });
      await stdin.write(keys.down);
      await stdin.write(keys.tab);
      await stdin.write("u");
      expect(lastFrame()).toContain("Failed to update");
    });

    it("returns to source list on escape", async () => {
      vi.mocked(discoverSkillSets).mockReturnValue([]);
      const { stdin, lastFrame } = renderSkillSets({
        skillSets: {
          sources: [{ url: "git@github.com:org/skills.git", enabledSets: [] }],
        },
      });
      await stdin.write(keys.down);
      await stdin.write(keys.tab);
      expect(lastFrame()).toContain("git@github.com:org/skills.git");
      await stdin.write(keys.escape);
      expect(lastFrame()).toContain("Skill Sets");
      expect(lastFrame()).toContain("Add source...");
    });
  });

  describe("navigation", () => {
    it("calls onBack on escape", async () => {
      const { stdin, onBack } = renderSkillSets();
      await stdin.write(keys.escape);
      expect(onBack).toHaveBeenCalled();
    });
  });
});
