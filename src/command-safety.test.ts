import { describe, expect, it } from "vitest";
import {
  isCompoundCommand,
  isDestructiveCommand,
  matchesCommandPattern,
} from "./command-safety";

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

describe("isDestructiveCommand", () => {
  it("detects rm -rf", () => {
    expect(isDestructiveCommand("rm -rf /tmp/foo")).toBe(true);
  });

  it("detects rm -r", () => {
    expect(isDestructiveCommand("rm -r /tmp/foo")).toBe(true);
  });

  it("detects rm -fr", () => {
    expect(isDestructiveCommand("rm -fr /tmp/foo")).toBe(true);
  });

  it("detects rm --recursive", () => {
    expect(isDestructiveCommand("rm --recursive /tmp/foo")).toBe(true);
  });

  it("detects rm --force", () => {
    expect(isDestructiveCommand("rm --force file.txt")).toBe(true);
  });

  it("does not flag simple rm", () => {
    expect(isDestructiveCommand("rm file.txt")).toBe(false);
  });

  it("detects git push --force", () => {
    expect(isDestructiveCommand("git push --force")).toBe(true);
  });

  it("detects git push -f", () => {
    expect(isDestructiveCommand("git push origin main -f")).toBe(true);
  });

  it("does not flag git push", () => {
    expect(isDestructiveCommand("git push")).toBe(false);
  });

  it("detects git reset --hard", () => {
    expect(isDestructiveCommand("git reset --hard HEAD~1")).toBe(true);
  });

  it("detects git clean -f", () => {
    expect(isDestructiveCommand("git clean -f")).toBe(true);
  });

  it("detects git clean -fd", () => {
    expect(isDestructiveCommand("git clean -fd")).toBe(true);
  });

  it("detects git clean --force", () => {
    expect(isDestructiveCommand("git clean --force")).toBe(true);
  });

  it("detects chmod -R", () => {
    expect(isDestructiveCommand("chmod -R 777 /var")).toBe(true);
  });

  it("detects chown -R", () => {
    expect(isDestructiveCommand("chown -R root:root /var")).toBe(true);
  });

  it("detects kill -9", () => {
    expect(isDestructiveCommand("kill -9 1234")).toBe(true);
  });

  it("detects killall", () => {
    expect(isDestructiveCommand("killall node")).toBe(true);
  });

  it("detects docker rm", () => {
    expect(isDestructiveCommand("docker rm container1")).toBe(true);
  });

  it("detects docker system prune", () => {
    expect(isDestructiveCommand("docker system prune")).toBe(true);
  });

  it("detects kubectl delete", () => {
    expect(isDestructiveCommand("kubectl delete pod foo")).toBe(true);
  });

  it("detects DROP TABLE (case insensitive)", () => {
    expect(isDestructiveCommand("DROP TABLE users")).toBe(true);
    expect(isDestructiveCommand("drop table users")).toBe(true);
  });

  it("detects DROP DATABASE (case insensitive)", () => {
    expect(isDestructiveCommand("DROP DATABASE mydb")).toBe(true);
    expect(isDestructiveCommand("drop database mydb")).toBe(true);
  });

  it("does not flag safe commands", () => {
    expect(isDestructiveCommand("git status")).toBe(false);
    expect(isDestructiveCommand("npm test")).toBe(false);
    expect(isDestructiveCommand("ls -la")).toBe(false);
    expect(isDestructiveCommand("docker ps")).toBe(false);
    expect(isDestructiveCommand("kubectl get pods")).toBe(false);
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
