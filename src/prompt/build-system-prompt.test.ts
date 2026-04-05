import { execSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockFs } from "../test-utils/mock-fs";
import { buildSystemPrompt } from "./build-system-prompt";

vi.mock("node:os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:os")>()),
  platform: () => "linux",
  release: () => "6.1.0",
  arch: () => "x64",
  userInfo: () => ({ username: "testuser" }),
  homedir: () => "/mock-home",
}));

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("buildSystemPrompt", () => {
  it("includes system info when not in a git repo and no instruction files exist", () => {
    vi.spyOn(process, "cwd").mockReturnValue("/mock-project");
    process.env.SHELL = "/bin/bash";
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("not a git repo");
    });
    const fs = mockFs({});

    const result = buildSystemPrompt();

    expect(result).toBe(
      "System: linux (6.1.0), arch: x64, shell: /bin/bash, user: testuser, cwd: /mock-project",
    );
    fs.restore();
  });

  it("includes git context when in a repo", () => {
    vi.spyOn(process, "cwd").mockReturnValue("/mock-project");
    process.env.SHELL = "/bin/bash";
    vi.mocked(execSync).mockImplementation((cmd) => {
      const command = String(cmd);
      if (command.includes("rev-parse --is-inside-work-tree"))
        return Buffer.from("true");
      if (command.includes("rev-parse --abbrev-ref HEAD"))
        return Buffer.from("main\n");
      if (command.includes("symbolic-ref"))
        return Buffer.from("refs/remotes/origin/main\n");
      if (command.includes("status --porcelain")) return Buffer.from("");
      if (command.includes("log --oneline"))
        return Buffer.from("abc1234 initial\n");
      if (command.includes("remote get-url origin"))
        return Buffer.from("git@gitlab.com:user/repo.git\n");
      throw new Error(`Unmocked: ${command}`);
    });
    const fs = mockFs({});

    const result = buildSystemPrompt();

    expect(result).toContain("System:");
    expect(result).toContain("Git:");
    expect(result).toContain("Branch: main");
    fs.restore();
  });

  it("includes instruction files when they exist", () => {
    vi.spyOn(process, "cwd").mockReturnValue("/mock-project");
    process.env.SHELL = "/bin/bash";
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("not a git repo");
    });
    const fs = mockFs({
      "/mock-home/tomo.md": "global instructions",
      "/mock-project/.tomo/tomo.md": "local instructions",
    });

    const result = buildSystemPrompt();

    expect(result).toContain("System:");
    expect(result).toContain("global instructions");
    expect(result).toContain("---");
    expect(result).toContain("local instructions");
    fs.restore();
  });

  it("includes all sections when git context and instructions are present", () => {
    vi.spyOn(process, "cwd").mockReturnValue("/mock-project");
    process.env.SHELL = "/bin/bash";
    vi.mocked(execSync).mockImplementation((cmd) => {
      const command = String(cmd);
      if (command.includes("rev-parse --is-inside-work-tree"))
        return Buffer.from("true");
      if (command.includes("rev-parse --abbrev-ref HEAD"))
        return Buffer.from("develop\n");
      if (command.includes("symbolic-ref"))
        return Buffer.from("refs/remotes/origin/main\n");
      if (command.includes("status --porcelain"))
        return Buffer.from(" M file.ts\n");
      if (command.includes("log --oneline"))
        return Buffer.from("abc1234 feat: add thing\n");
      if (command.includes("remote get-url origin"))
        return Buffer.from("git@github.com:user/repo.git\n");
      if (command.includes("which gh")) return Buffer.from("/usr/bin/gh\n");
      throw new Error(`Unmocked: ${command}`);
    });
    const fs = mockFs({
      "/mock-home/tomo.md": "be helpful",
    });

    const result = buildSystemPrompt();

    // Verify sections appear in order separated by double newlines
    const systemIdx = result.indexOf("System:");
    const gitIdx = result.indexOf("Git:");
    const instructionsIdx = result.indexOf("be helpful");

    expect(systemIdx).toBeLessThan(gitIdx);
    expect(gitIdx).toBeLessThan(instructionsIdx);
    expect(result).toContain("Branch: develop");
    expect(result).toContain("1 changed file");
    expect(result).toContain("gh CLI is available");
    fs.restore();
  });
});
