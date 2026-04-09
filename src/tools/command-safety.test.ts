import { describe, expect, it } from "vitest";
import { isCommandAllowed, isCompoundCommand } from "./command-safety";

describe("isCompoundCommand", () => {
  it("returns false for simple commands", () => {
    expect(isCompoundCommand("git status")).toBe(false);
    expect(isCompoundCommand("npm test")).toBe(false);
    expect(isCompoundCommand("ls -la")).toBe(false);
    expect(isCompoundCommand("echo hello world")).toBe(false);
  });

  it("detects && chaining", () => {
    expect(isCompoundCommand("git add . && git commit")).toBe(true);
  });

  it("detects || chaining", () => {
    expect(isCompoundCommand("test -f file || echo missing")).toBe(true);
  });

  it("detects ; separator", () => {
    expect(isCompoundCommand("echo a; echo b")).toBe(true);
  });

  it("detects | pipe", () => {
    expect(isCompoundCommand("ls | grep foo")).toBe(true);
  });

  it("detects $() command substitution", () => {
    expect(isCompoundCommand("echo $(whoami)")).toBe(true);
  });

  it("detects backtick command substitution", () => {
    expect(isCompoundCommand("echo `whoami`")).toBe(true);
  });

  it("detects > output redirection", () => {
    expect(isCompoundCommand("echo hello > file.txt")).toBe(true);
  });

  it("detects >> append redirection", () => {
    expect(isCompoundCommand("echo hello >> file.txt")).toBe(true);
  });

  it("detects < input redirection", () => {
    expect(isCompoundCommand("wc -l < file.txt")).toBe(true);
  });

  it("detects & backgrounding", () => {
    expect(isCompoundCommand("long-running-cmd &")).toBe(true);
  });
});

describe("isCommandAllowed", () => {
  it("returns false for empty allowed list", () => {
    expect(isCommandAllowed("git status", [])).toBe(false);
  });

  it("matches exact commands", () => {
    expect(isCommandAllowed("npm test", ["npm test"])).toBe(true);
  });

  it("does not match partial commands", () => {
    expect(isCommandAllowed("npm test:watch", ["npm test"])).toBe(false);
  });

  it("does not match superstrings of allowed commands", () => {
    expect(isCommandAllowed("npm test -- --verbose", ["npm test"])).toBe(false);
  });

  it("matches prefix patterns with :*", () => {
    expect(isCommandAllowed("git status", ["git:*"])).toBe(true);
    expect(isCommandAllowed("git diff --staged", ["git:*"])).toBe(true);
  });

  it("does not match different base commands for prefix patterns", () => {
    expect(isCommandAllowed("npm test", ["git:*"])).toBe(false);
  });

  it("trims whitespace from the command before matching", () => {
    expect(isCommandAllowed("  npm test  ", ["npm test"])).toBe(true);
  });

  it("matches against multiple allowed entries", () => {
    const allowed = ["npm test", "git:*", "pnpm build"];
    expect(isCommandAllowed("git log", allowed)).toBe(true);
    expect(isCommandAllowed("pnpm build", allowed)).toBe(true);
    expect(isCommandAllowed("rm -rf /", allowed)).toBe(false);
  });

  it("returns false for an empty command", () => {
    expect(isCommandAllowed("", ["git:*"])).toBe(false);
  });

  it("returns false for a whitespace-only command", () => {
    expect(isCommandAllowed("   ", ["git:*"])).toBe(false);
  });
});
