import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadInstructions } from "./instructions";

const tmpDir = resolve(import.meta.dirname, "../.test-instructions-tmp");
const globalTomoDir = resolve(tmpDir, "global/.tomo");
const globalClaudeDir = resolve(tmpDir, "global/.claude");
const localTomoDir = resolve(tmpDir, "local/.tomo");
const localBareDir = resolve(tmpDir, "local");

vi.mock("node:os", () => ({
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

describe("loadInstructions", () => {
  it("returns null when no instruction files exist", () => {
    expect(loadInstructions()).toBeNull();
  });

  it("loads root claude.md", () => {
    mkdirSync(globalTomoDir, { recursive: true });
    writeFileSync(resolve(globalTomoDir, "claude.md"), "root instructions");

    expect(loadInstructions()).toBe("root instructions");
  });

  it("loads local claude.md", () => {
    mkdirSync(localTomoDir, { recursive: true });
    writeFileSync(resolve(localTomoDir, "claude.md"), "local instructions");

    expect(loadInstructions()).toBe("local instructions");
  });

  it("combines root and local with separator", () => {
    mkdirSync(globalTomoDir, { recursive: true });
    mkdirSync(localTomoDir, { recursive: true });
    writeFileSync(resolve(globalTomoDir, "claude.md"), "root");
    writeFileSync(resolve(localTomoDir, "claude.md"), "local");

    expect(loadInstructions()).toBe("root\n\n---\n\nlocal");
  });

  it("finds files case-insensitively", () => {
    mkdirSync(globalTomoDir, { recursive: true });
    writeFileSync(resolve(globalTomoDir, "CLAUDE.md"), "uppercase root");

    expect(loadInstructions()).toBe("uppercase root");
  });

  it("prefers claude.md over agents.md", () => {
    mkdirSync(globalTomoDir, { recursive: true });
    writeFileSync(resolve(globalTomoDir, "claude.md"), "from claude");
    writeFileSync(resolve(globalTomoDir, "agents.md"), "from agents");

    expect(loadInstructions()).toBe("from claude");
  });

  it("falls back to agents.md when no claude.md exists", () => {
    mkdirSync(globalTomoDir, { recursive: true });
    writeFileSync(resolve(globalTomoDir, "agents.md"), "agent instructions");

    expect(loadInstructions()).toBe("agent instructions");
  });

  it("local agents.md only pairs with root agents.md", () => {
    mkdirSync(globalTomoDir, { recursive: true });
    mkdirSync(localTomoDir, { recursive: true });
    writeFileSync(resolve(globalTomoDir, "claude.md"), "root claude");
    writeFileSync(resolve(localTomoDir, "agents.md"), "local agents");

    // root claude.md is ignored because local is agents.md
    expect(loadInstructions()).toBe("local agents");
  });

  it("combines when local and root use the same filename", () => {
    mkdirSync(globalTomoDir, { recursive: true });
    mkdirSync(localTomoDir, { recursive: true });
    writeFileSync(resolve(globalTomoDir, "agents.md"), "root agents");
    writeFileSync(resolve(localTomoDir, "agents.md"), "local agents");

    expect(loadInstructions()).toBe("root agents\n\n---\n\nlocal agents");
  });

  it("falls back to .claude/ when .tomo/ has no instructions", () => {
    mkdirSync(globalClaudeDir, { recursive: true });
    writeFileSync(resolve(globalClaudeDir, "claude.md"), "from .claude");

    expect(loadInstructions()).toBe("from .claude");
  });

  it("prefers .tomo/ over .claude/", () => {
    mkdirSync(globalTomoDir, { recursive: true });
    mkdirSync(globalClaudeDir, { recursive: true });
    writeFileSync(resolve(globalTomoDir, "claude.md"), "from tomo");
    writeFileSync(resolve(globalClaudeDir, "claude.md"), "from claude dir");

    expect(loadInstructions()).toBe("from tomo");
  });

  it("falls back to bare directory for agents.md", () => {
    mkdirSync(localBareDir, { recursive: true });
    writeFileSync(resolve(localBareDir, "AGENTS.md"), "project agents");

    expect(loadInstructions()).toBe("project agents");
  });

  it("prefers .tomo/ over bare directory", () => {
    mkdirSync(localTomoDir, { recursive: true });
    mkdirSync(localBareDir, { recursive: true });
    writeFileSync(resolve(localTomoDir, "claude.md"), "from tomo");
    writeFileSync(resolve(localBareDir, "AGENTS.md"), "from bare");

    expect(loadInstructions()).toBe("from tomo");
  });

  it("local file matches root across different directory types", () => {
    mkdirSync(globalClaudeDir, { recursive: true });
    mkdirSync(localBareDir, { recursive: true });
    writeFileSync(resolve(globalClaudeDir, "agents.md"), "global agents");
    writeFileSync(resolve(localBareDir, "AGENTS.md"), "local agents");

    expect(loadInstructions()).toBe("global agents\n\n---\n\nlocal agents");
  });

  it("ignores empty files", () => {
    mkdirSync(globalTomoDir, { recursive: true });
    mkdirSync(localTomoDir, { recursive: true });
    writeFileSync(resolve(globalTomoDir, "claude.md"), "   ");
    writeFileSync(resolve(localTomoDir, "claude.md"), "local only");

    expect(loadInstructions()).toBe("local only");
  });
});
