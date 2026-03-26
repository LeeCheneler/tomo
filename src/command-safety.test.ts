import { describe, expect, it } from "vitest";
import { isCompoundCommand, matchesCommandPattern } from "./command-safety";

describe("isCompoundCommand", () => {
  it("detects &&", () => {
    expect(isCompoundCommand("echo a && echo b")).toBe(true);
  });

  it("detects ||", () => {
    expect(isCompoundCommand("echo a || echo b")).toBe(true);
  });

  it("detects ;", () => {
    expect(isCompoundCommand("echo a; echo b")).toBe(true);
  });

  it("detects |", () => {
    expect(isCompoundCommand("echo a | grep b")).toBe(true);
  });

  it("detects $()", () => {
    expect(isCompoundCommand("echo $(whoami)")).toBe(true);
  });

  it("detects backticks", () => {
    expect(isCompoundCommand("echo `whoami`")).toBe(true);
  });

  it("ignores operators inside double quotes", () => {
    expect(isCompoundCommand('echo "a && b"')).toBe(false);
  });

  it("ignores operators inside single quotes", () => {
    expect(isCompoundCommand("echo 'a && b'")).toBe(false);
  });

  it("detects operators outside quotes even when quotes present", () => {
    expect(isCompoundCommand('echo "hello" && rm -rf /')).toBe(true);
  });

  it("returns false for simple commands", () => {
    expect(isCompoundCommand("git status")).toBe(false);
    expect(isCompoundCommand("npm test")).toBe(false);
    expect(isCompoundCommand("ls -la")).toBe(false);
  });
});

describe("matchesCommandPattern", () => {
  it("matches wildcard pattern", () => {
    expect(matchesCommandPattern("git status", "git *")).toBe(true);
    expect(matchesCommandPattern("git diff --staged", "git *")).toBe(true);
  });

  it("does not match different prefix", () => {
    expect(matchesCommandPattern("npm test", "git *")).toBe(false);
  });

  it("does not match partial prefix", () => {
    expect(matchesCommandPattern("gitconfig", "git *")).toBe(false);
  });

  it("matches exact pattern without wildcard", () => {
    expect(matchesCommandPattern("npm test", "npm test")).toBe(true);
  });

  it("does not match longer command with exact pattern", () => {
    expect(matchesCommandPattern("npm test --watch", "npm test")).toBe(false);
  });

  it("matches catch-all wildcard", () => {
    expect(matchesCommandPattern("anything", "*")).toBe(true);
  });

  it("matches npm patterns", () => {
    expect(matchesCommandPattern("npm install", "npm *")).toBe(true);
    expect(matchesCommandPattern("npm run build", "npm *")).toBe(true);
  });

  it("matches ls patterns", () => {
    expect(matchesCommandPattern("ls -la", "ls *")).toBe(true);
  });
});
