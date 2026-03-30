import { describe, expect, it } from "vitest";
import { isCommandAllowed, isCompoundCommand } from "./command-safety";

describe("isCompoundCommand", () => {
  describe("chaining operators", () => {
    it("detects &&", () => {
      expect(isCompoundCommand("echo a && echo b")).toBe(true);
    });

    it("detects ||", () => {
      expect(isCompoundCommand("echo a || echo b")).toBe(true);
    });

    it("detects ;", () => {
      expect(isCompoundCommand("echo a; echo b")).toBe(true);
    });
  });

  describe("pipes", () => {
    it("detects |", () => {
      expect(isCompoundCommand("echo a | grep b")).toBe(true);
    });
  });

  describe("subshell and substitution", () => {
    it("detects $()", () => {
      expect(isCompoundCommand("echo $(whoami)")).toBe(true);
    });

    it("detects parameter expansion", () => {
      // biome-ignore lint/suspicious/noTemplateCurlyInString: testing shell syntax
      expect(isCompoundCommand("echo ${HOME}")).toBe(true);
    });

    it("detects backticks", () => {
      expect(isCompoundCommand("echo `whoami`")).toBe(true);
    });
  });

  describe("process substitution", () => {
    it("detects <()", () => {
      expect(isCompoundCommand("diff <(cat a.txt) b.txt")).toBe(true);
    });

    it("detects >()", () => {
      expect(isCompoundCommand("tee >(grep error)")).toBe(true);
    });
  });

  describe("newlines", () => {
    it("detects newlines", () => {
      expect(isCompoundCommand("echo a\necho b")).toBe(true);
    });

    it("detects newlines even inside would-be quotes", () => {
      expect(isCompoundCommand("echo 'a\nb'")).toBe(true);
    });
  });

  describe("quoting safety", () => {
    it("ignores operators inside double quotes", () => {
      expect(isCompoundCommand('echo "a && b"')).toBe(false);
    });

    it("ignores operators inside single quotes", () => {
      expect(isCompoundCommand("echo 'a && b'")).toBe(false);
    });

    it("handles escaped quotes inside double quotes", () => {
      expect(isCompoundCommand('echo "hello \\"world\\"" && rm -rf /')).toBe(
        true,
      );
    });

    it("does not treat escaped quote as closing", () => {
      // "hello \" still quoted" is one quoted string — no && outside
      expect(isCompoundCommand('echo "hello \\" still quoted"')).toBe(false);
    });

    it("detects operators outside quotes even when quotes present", () => {
      expect(isCompoundCommand('echo "hello" && rm -rf /')).toBe(true);
    });

    it("handles adjacent quoted strings", () => {
      expect(isCompoundCommand("echo 'a'\"b\"")).toBe(false);
    });

    it("handles mixed quotes with operators outside", () => {
      expect(isCompoundCommand("echo 'hello' | grep 'world'")).toBe(true);
    });
  });

  describe("safe commands (should return false)", () => {
    it("simple commands", () => {
      expect(isCompoundCommand("git status")).toBe(false);
      expect(isCompoundCommand("npm test")).toBe(false);
      expect(isCompoundCommand("ls -la")).toBe(false);
    });

    it("commands with arguments", () => {
      expect(isCompoundCommand("git commit -m 'fix: something'")).toBe(false);
      expect(isCompoundCommand('git commit -m "fix: something"')).toBe(false);
    });

    it("commands with flags", () => {
      expect(isCompoundCommand("git diff --staged --name-only")).toBe(false);
    });

    it("commands with paths", () => {
      expect(isCompoundCommand("cat /etc/hostname")).toBe(false);
    });

    it("commands with equals signs", () => {
      expect(isCompoundCommand("ENV_VAR=value npm test")).toBe(false);
    });

    it("commands with redirects are not compound", () => {
      // Redirects are single commands, not command chaining
      expect(isCompoundCommand("echo hello > file.txt")).toBe(false);
      expect(isCompoundCommand("cat < input.txt")).toBe(false);
      expect(isCompoundCommand("echo hello >> file.txt")).toBe(false);
    });
  });
});

describe("isCommandAllowed", () => {
  describe("exact match", () => {
    it("matches exact command", () => {
      expect(isCommandAllowed("npm test", ["npm test"])).toBe(true);
    });

    it("does not match partial command", () => {
      expect(isCommandAllowed("npm test --watch", ["npm test"])).toBe(false);
    });

    it("does not match different command", () => {
      expect(isCommandAllowed("yarn test", ["npm test"])).toBe(false);
    });

    it("matches exact compound command", () => {
      expect(isCommandAllowed("echo a && echo b", ["echo a && echo b"])).toBe(
        true,
      );
    });
  });

  describe("prefix match", () => {
    it("matches command with matching first word", () => {
      expect(isCommandAllowed("git status", ["git:*"])).toBe(true);
    });

    it("matches command with args", () => {
      expect(isCommandAllowed("git diff --staged", ["git:*"])).toBe(true);
    });

    it("matches bare command", () => {
      expect(isCommandAllowed("git", ["git:*"])).toBe(true);
    });

    it("does not match different prefix", () => {
      expect(isCommandAllowed("npm test", ["git:*"])).toBe(false);
    });

    it("does not match partial word", () => {
      expect(isCommandAllowed("gitconfig", ["git:*"])).toBe(false);
    });

    it("skips prefix match when skipPrefix is true", () => {
      expect(
        isCommandAllowed("git status", ["git:*"], { skipPrefix: true }),
      ).toBe(false);
    });
  });

  describe("mixed list", () => {
    const allowed = ["npm test", "git:*", "ls:*"];

    it("matches exact entry", () => {
      expect(isCommandAllowed("npm test", allowed)).toBe(true);
    });

    it("matches prefix entry", () => {
      expect(isCommandAllowed("git status", allowed)).toBe(true);
      expect(isCommandAllowed("ls -la", allowed)).toBe(true);
    });

    it("does not match unrelated command", () => {
      expect(isCommandAllowed("rm -rf /", allowed)).toBe(false);
    });
  });

  it("returns false for empty list", () => {
    expect(isCommandAllowed("git status", [])).toBe(false);
  });
});
