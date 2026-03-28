import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as git from "./git";
import { getGitContext, getSystemInfo, loadInstructions } from "./instructions";

const tmpDir = resolve(import.meta.dirname, "../.test-instructions-tmp");
const globalTomoDir = resolve(tmpDir, "global/.tomo");
const globalClaudeDir = resolve(tmpDir, "global/.claude");
const localTomoDir = resolve(tmpDir, "local/.tomo");
const localBareDir = resolve(tmpDir, "local");

vi.mock("node:os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:os")>()),
  homedir: () => resolve(tmpDir, "global"),
}));

beforeEach(() => {
  mkdirSync(tmpDir, { recursive: true });
  vi.spyOn(process, "cwd").mockReturnValue(resolve(tmpDir, "local"));
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

  it("loads root claude.md", () => {
    mkdirSync(globalTomoDir, { recursive: true });
    writeFileSync(resolve(globalTomoDir, "claude.md"), "root instructions");

    const result = loadInstructions();
    expect(result).toContain("System:");
    expect(result).toContain("root instructions");
  });

  it("loads local claude.md", () => {
    mkdirSync(localTomoDir, { recursive: true });
    writeFileSync(resolve(localTomoDir, "claude.md"), "local instructions");

    const result = loadInstructions();
    expect(result).toContain("local instructions");
  });

  it("combines root and local with separator", () => {
    mkdirSync(globalTomoDir, { recursive: true });
    mkdirSync(localTomoDir, { recursive: true });
    writeFileSync(resolve(globalTomoDir, "claude.md"), "root");
    writeFileSync(resolve(localTomoDir, "claude.md"), "local");

    const result = loadInstructions();
    expect(result).toContain("root\n\n---\n\nlocal");
  });

  it("finds files case-insensitively", () => {
    mkdirSync(globalTomoDir, { recursive: true });
    writeFileSync(resolve(globalTomoDir, "CLAUDE.md"), "uppercase root");

    expect(loadInstructions()).toContain("uppercase root");
  });

  it("prefers claude.md over agents.md", () => {
    mkdirSync(globalTomoDir, { recursive: true });
    writeFileSync(resolve(globalTomoDir, "claude.md"), "from claude");
    writeFileSync(resolve(globalTomoDir, "agents.md"), "from agents");

    const result = loadInstructions();
    expect(result).toContain("from claude");
    expect(result).not.toContain("from agents");
  });

  it("falls back to agents.md when no claude.md exists", () => {
    mkdirSync(globalTomoDir, { recursive: true });
    writeFileSync(resolve(globalTomoDir, "agents.md"), "agent instructions");

    expect(loadInstructions()).toContain("agent instructions");
  });

  it("local agents.md only pairs with root agents.md", () => {
    mkdirSync(globalTomoDir, { recursive: true });
    mkdirSync(localTomoDir, { recursive: true });
    writeFileSync(resolve(globalTomoDir, "claude.md"), "root claude");
    writeFileSync(resolve(localTomoDir, "agents.md"), "local agents");

    // root claude.md is ignored because local is agents.md
    const result = loadInstructions();
    expect(result).toContain("local agents");
    expect(result).not.toContain("root claude");
  });

  it("combines when local and root use the same filename", () => {
    mkdirSync(globalTomoDir, { recursive: true });
    mkdirSync(localTomoDir, { recursive: true });
    writeFileSync(resolve(globalTomoDir, "agents.md"), "root agents");
    writeFileSync(resolve(localTomoDir, "agents.md"), "local agents");

    const result = loadInstructions();
    expect(result).toContain("root agents\n\n---\n\nlocal agents");
  });

  it("falls back to .claude/ when .tomo/ has no instructions", () => {
    mkdirSync(globalClaudeDir, { recursive: true });
    writeFileSync(resolve(globalClaudeDir, "claude.md"), "from .claude");

    expect(loadInstructions()).toContain("from .claude");
  });

  it("prefers .tomo/ over .claude/", () => {
    mkdirSync(globalTomoDir, { recursive: true });
    mkdirSync(globalClaudeDir, { recursive: true });
    writeFileSync(resolve(globalTomoDir, "claude.md"), "from tomo");
    writeFileSync(resolve(globalClaudeDir, "claude.md"), "from claude dir");

    const result = loadInstructions();
    expect(result).toContain("from tomo");
    expect(result).not.toContain("from claude dir");
  });

  it("falls back to bare directory for agents.md", () => {
    mkdirSync(localBareDir, { recursive: true });
    writeFileSync(resolve(localBareDir, "AGENTS.md"), "project agents");

    expect(loadInstructions()).toContain("project agents");
  });

  it("prefers .tomo/ over bare directory", () => {
    mkdirSync(localTomoDir, { recursive: true });
    mkdirSync(localBareDir, { recursive: true });
    writeFileSync(resolve(localTomoDir, "claude.md"), "from tomo");
    writeFileSync(resolve(localBareDir, "AGENTS.md"), "from bare");

    const result = loadInstructions();
    expect(result).toContain("from tomo");
    expect(result).not.toContain("from bare");
  });

  it("local file matches root across different directory types", () => {
    mkdirSync(globalClaudeDir, { recursive: true });
    mkdirSync(localBareDir, { recursive: true });
    writeFileSync(resolve(globalClaudeDir, "agents.md"), "global agents");
    writeFileSync(resolve(localBareDir, "AGENTS.md"), "local agents");

    const result = loadInstructions();
    expect(result).toContain("global agents\n\n---\n\nlocal agents");
  });

  it("ignores empty files", () => {
    mkdirSync(globalTomoDir, { recursive: true });
    mkdirSync(localTomoDir, { recursive: true });
    writeFileSync(resolve(globalTomoDir, "claude.md"), "   ");
    writeFileSync(resolve(localTomoDir, "claude.md"), "local only");

    expect(loadInstructions()).toContain("local only");
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

    const result = getGitContext();
    expect(result).toContain("gh CLI is available");
  });

  it("includes GitHub hint without gh available", () => {
    vi.spyOn(git, "isGitRepo").mockReturnValue(true);
    vi.spyOn(git, "getGitBranch").mockReturnValue("main");
    vi.spyOn(git, "getDefaultBranch").mockReturnValue("main");
    vi.spyOn(git, "getGitStatusSummary").mockReturnValue("clean");
    vi.spyOn(git, "getGitLog").mockReturnValue("");
    vi.spyOn(git, "isGitHubRemote").mockReturnValue(true);
    vi.spyOn(git, "isGhCliAvailable").mockReturnValue(false);

    const result = getGitContext();
    expect(result).toContain("gh CLI is not installed");
  });

  it("shows dirty status summary", () => {
    vi.spyOn(git, "isGitRepo").mockReturnValue(true);
    vi.spyOn(git, "getGitBranch").mockReturnValue("main");
    vi.spyOn(git, "getDefaultBranch").mockReturnValue("main");
    vi.spyOn(git, "getGitStatusSummary").mockReturnValue("3 changed files");
    vi.spyOn(git, "getGitLog").mockReturnValue("");
    vi.spyOn(git, "isGitHubRemote").mockReturnValue(false);

    const result = getGitContext();
    expect(result).toContain("Working tree: 3 changed files");
  });

  it("includes git context in loadInstructions when in a repo", () => {
    vi.spyOn(git, "isGitRepo").mockReturnValue(true);
    vi.spyOn(git, "getGitBranch").mockReturnValue("develop");
    vi.spyOn(git, "getDefaultBranch").mockReturnValue("main");
    vi.spyOn(git, "getGitStatusSummary").mockReturnValue("clean");
    vi.spyOn(git, "getGitLog").mockReturnValue("abc1234 some commit");
    vi.spyOn(git, "isGitHubRemote").mockReturnValue(false);

    const result = loadInstructions();
    expect(result).toContain("System:");
    expect(result).toContain("Branch: develop");
  });
});
