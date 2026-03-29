import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as git from "./git";
import { getGitContext, getSystemInfo, loadInstructions } from "./instructions";

const tmpDir = resolve(import.meta.dirname, "../.test-instructions-tmp");
const globalHome = resolve(tmpDir, "global");
const localCwd = resolve(tmpDir, "local");
const localTomoDir = resolve(localCwd, ".tomo");

vi.mock("node:os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:os")>()),
  homedir: () => globalHome,
}));

beforeEach(() => {
  mkdirSync(globalHome, { recursive: true });
  mkdirSync(localTomoDir, { recursive: true });
  vi.spyOn(process, "cwd").mockReturnValue(localCwd);
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("getSystemInfo", () => {
  it("returns a string with platform and architecture", () => {
    const info = getSystemInfo();
    expect(info).toContain("System:");
    expect(info).toContain("arch:");
    expect(info).toContain("shell:");
  });
});

describe("loadInstructions", () => {
  it("returns system info when no instruction files exist", () => {
    const result = loadInstructions();
    expect(result).toContain("System:");
    expect(result).not.toContain("---");
  });

  it("loads global ~/tomo.md", () => {
    writeFileSync(resolve(globalHome, "tomo.md"), "global instructions");

    const result = loadInstructions();
    expect(result).toContain("global instructions");
  });

  it("loads local .tomo/tomo.md", () => {
    writeFileSync(resolve(localTomoDir, "tomo.md"), "local instructions");

    const result = loadInstructions();
    expect(result).toContain("local instructions");
  });

  it("combines global and local with separator", () => {
    writeFileSync(resolve(globalHome, "tomo.md"), "global");
    writeFileSync(resolve(localTomoDir, "tomo.md"), "local");

    const result = loadInstructions();
    expect(result).toContain("global\n\n---\n\nlocal");
  });

  it("does not load claude.md or agents.md", () => {
    mkdirSync(resolve(globalHome, ".tomo"), { recursive: true });
    writeFileSync(resolve(globalHome, ".tomo", "claude.md"), "should not load");
    writeFileSync(resolve(globalHome, ".tomo", "agents.md"), "should not load");

    const result = loadInstructions();
    expect(result).not.toContain("should not load");
  });

  it("ignores empty files", () => {
    writeFileSync(resolve(globalHome, "tomo.md"), "   ");
    writeFileSync(resolve(localTomoDir, "tomo.md"), "local only");

    const result = loadInstructions();
    expect(result).toContain("local only");
    expect(result).not.toContain("---");
  });

  it("includes tool usage guidance", () => {
    const result = loadInstructions();
    expect(result).toContain("Using your tools");
  });

  it("includes git context in loadInstructions when in a repo", () => {
    vi.spyOn(git, "isGitRepo").mockReturnValue(true);
    vi.spyOn(git, "getGitBranch").mockReturnValue("develop");
    vi.spyOn(git, "getDefaultBranch").mockReturnValue("main");
    vi.spyOn(git, "getGitStatusSummary").mockReturnValue("clean");
    vi.spyOn(git, "getGitLog").mockReturnValue("abc1234 some commit");
    vi.spyOn(git, "isGitHubRemote").mockReturnValue(false);

    const result = loadInstructions();
    expect(result).toContain("Branch: develop");
  });
});

describe("getGitContext", () => {
  it("returns null when not in a git repo", () => {
    vi.spyOn(git, "isGitRepo").mockReturnValue(false);
    expect(getGitContext()).toBeNull();
  });

  it("returns git context when in a git repo", () => {
    vi.spyOn(git, "isGitRepo").mockReturnValue(true);
    vi.spyOn(git, "getGitBranch").mockReturnValue("feat/my-branch");
    vi.spyOn(git, "getDefaultBranch").mockReturnValue("main");
    vi.spyOn(git, "getGitStatusSummary").mockReturnValue("clean");
    vi.spyOn(git, "getGitLog").mockReturnValue("abc1234 initial commit");
    vi.spyOn(git, "isGitHubRemote").mockReturnValue(false);

    const result = getGitContext();
    expect(result).toContain("Branch: feat/my-branch");
    expect(result).toContain("Default branch: main");
    expect(result).toContain("Working tree: clean");
    expect(result).toContain("abc1234 initial commit");
  });

  it("includes GitHub hint with gh available", () => {
    vi.spyOn(git, "isGitRepo").mockReturnValue(true);
    vi.spyOn(git, "getGitBranch").mockReturnValue("main");
    vi.spyOn(git, "getDefaultBranch").mockReturnValue("main");
    vi.spyOn(git, "getGitStatusSummary").mockReturnValue("clean");
    vi.spyOn(git, "getGitLog").mockReturnValue("");
    vi.spyOn(git, "isGitHubRemote").mockReturnValue(true);
    vi.spyOn(git, "isGhCliAvailable").mockReturnValue(true);

    expect(getGitContext()).toContain("gh CLI is available");
  });

  it("includes GitHub hint without gh available", () => {
    vi.spyOn(git, "isGitRepo").mockReturnValue(true);
    vi.spyOn(git, "getGitBranch").mockReturnValue("main");
    vi.spyOn(git, "getDefaultBranch").mockReturnValue("main");
    vi.spyOn(git, "getGitStatusSummary").mockReturnValue("clean");
    vi.spyOn(git, "getGitLog").mockReturnValue("");
    vi.spyOn(git, "isGitHubRemote").mockReturnValue(true);
    vi.spyOn(git, "isGhCliAvailable").mockReturnValue(false);

    expect(getGitContext()).toContain("gh CLI is not installed");
  });
});
