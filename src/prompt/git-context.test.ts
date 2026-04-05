import { execSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDefaultBranch,
  getGitBranch,
  getGitContext,
  getGitLog,
  getGitRemoteUrl,
  getGitStatusSummary,
  isGhCliAvailable,
  isGitHubRemote,
  isGitRepo,
} from "./git-context";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

afterEach(() => {
  vi.mocked(execSync).mockReset();
});

/** Configures execSync to return different values based on the command string. */
function mockGitCommands(commands: Record<string, string>) {
  vi.mocked(execSync).mockImplementation((cmd) => {
    const command = String(cmd);
    for (const [pattern, value] of Object.entries(commands)) {
      if (command.includes(pattern)) return Buffer.from(value);
    }
    throw new Error(`Command not mocked: ${command}`);
  });
}

describe("isGitRepo", () => {
  it("returns true when rev-parse succeeds", () => {
    mockGitCommands({ "rev-parse --is-inside-work-tree": "true" });
    expect(isGitRepo("/repo")).toBe(true);
  });

  it("returns false when rev-parse throws", () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("not a git repo");
    });
    expect(isGitRepo("/tmp")).toBe(false);
  });
});

describe("getGitBranch", () => {
  it("returns the current branch name", () => {
    mockGitCommands({ "rev-parse --abbrev-ref HEAD": "feat/my-branch\n" });
    expect(getGitBranch("/repo")).toBe("feat/my-branch");
  });
});

describe("getDefaultBranch", () => {
  it("returns the default branch from origin HEAD", () => {
    mockGitCommands({
      "symbolic-ref refs/remotes/origin/HEAD": "refs/remotes/origin/develop\n",
    });
    expect(getDefaultBranch("/repo")).toBe("develop");
  });

  it("falls back to main when symbolic-ref throws", () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("no origin HEAD");
    });
    expect(getDefaultBranch("/repo")).toBe("main");
  });
});

describe("getGitStatusSummary", () => {
  it("returns clean when status is empty", () => {
    mockGitCommands({ "status --porcelain": "" });
    expect(getGitStatusSummary("/repo")).toBe("clean");
  });

  it("returns singular file count for one change", () => {
    mockGitCommands({ "status --porcelain": " M file.ts\n" });
    expect(getGitStatusSummary("/repo")).toBe("1 changed file");
  });

  it("returns plural file count for multiple changes", () => {
    mockGitCommands({ "status --porcelain": " M a.ts\n M b.ts\n M c.ts\n" });
    expect(getGitStatusSummary("/repo")).toBe("3 changed files");
  });
});

describe("getGitLog", () => {
  it("returns commit log output", () => {
    mockGitCommands({ "log --oneline": "abc1234 first commit\n" });
    expect(getGitLog("/repo", 5)).toBe("abc1234 first commit");
  });
});

describe("getGitRemoteUrl", () => {
  it("returns the origin remote URL", () => {
    mockGitCommands({
      "remote get-url origin": "git@github.com:user/repo.git\n",
    });
    expect(getGitRemoteUrl("/repo")).toBe("git@github.com:user/repo.git");
  });

  it("returns null when there is no origin remote", () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("no remote");
    });
    expect(getGitRemoteUrl("/repo")).toBeNull();
  });
});

describe("isGitHubRemote", () => {
  it("returns true when remote contains github.com", () => {
    mockGitCommands({
      "remote get-url origin": "git@github.com:user/repo.git\n",
    });
    expect(isGitHubRemote("/repo")).toBe(true);
  });

  it("returns false when remote does not contain github.com", () => {
    mockGitCommands({
      "remote get-url origin": "git@gitlab.com:user/repo.git\n",
    });
    expect(isGitHubRemote("/repo")).toBe(false);
  });

  it("returns false when there is no remote", () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("no remote");
    });
    expect(isGitHubRemote("/repo")).toBe(false);
  });
});

describe("isGhCliAvailable", () => {
  it("returns true when which gh succeeds", () => {
    mockGitCommands({ "which gh": "/usr/local/bin/gh\n" });
    expect(isGhCliAvailable()).toBe(true);
  });

  it("returns false when which gh throws", () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("not found");
    });
    expect(isGhCliAvailable()).toBe(false);
  });
});

describe("getGitContext", () => {
  it("returns null when not in a git repo", () => {
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("not a git repo");
    });
    expect(getGitContext("/tmp")).toBeNull();
  });

  it("returns formatted context with branch, status, and commits", () => {
    mockGitCommands({
      "rev-parse --is-inside-work-tree": "true",
      "rev-parse --abbrev-ref HEAD": "feat/my-branch\n",
      "symbolic-ref refs/remotes/origin/HEAD": "refs/remotes/origin/main\n",
      "status --porcelain": "",
      "log --oneline": "abc1234 initial commit\n",
      "remote get-url origin": "git@gitlab.com:user/repo.git\n",
    });

    const result = getGitContext("/repo");

    expect(result).toContain("Git:");
    expect(result).toContain("Branch: feat/my-branch");
    expect(result).toContain("Default branch: main");
    expect(result).toContain("Working tree: clean");
    expect(result).toContain("abc1234 initial commit");
    expect(result).not.toContain("GitHub");
  });

  it("omits recent commits section when log is empty", () => {
    mockGitCommands({
      "rev-parse --is-inside-work-tree": "true",
      "rev-parse --abbrev-ref HEAD": "main\n",
      "symbolic-ref refs/remotes/origin/HEAD": "refs/remotes/origin/main\n",
      "status --porcelain": "",
      "log --oneline": "",
      "remote get-url origin": "",
    });

    const result = getGitContext("/repo");

    expect(result).not.toContain("Recent commits");
  });

  it("includes GitHub hint when remote is GitHub and gh is available", () => {
    mockGitCommands({
      "rev-parse --is-inside-work-tree": "true",
      "rev-parse --abbrev-ref HEAD": "main\n",
      "symbolic-ref refs/remotes/origin/HEAD": "refs/remotes/origin/main\n",
      "status --porcelain": "",
      "log --oneline": "",
      "remote get-url origin": "git@github.com:user/repo.git\n",
      "which gh": "/usr/local/bin/gh\n",
    });

    const result = getGitContext("/repo");

    expect(result).toContain("gh CLI is available");
  });

  it("includes GitHub hint when gh is not installed", () => {
    vi.mocked(execSync).mockImplementation((cmd) => {
      const command = String(cmd);
      if (command.includes("rev-parse --is-inside-work-tree"))
        return Buffer.from("true");
      if (command.includes("rev-parse --abbrev-ref HEAD"))
        return Buffer.from("main\n");
      if (command.includes("symbolic-ref"))
        return Buffer.from("refs/remotes/origin/main\n");
      if (command.includes("status --porcelain")) return Buffer.from("");
      if (command.includes("log --oneline")) return Buffer.from("");
      if (command.includes("remote get-url origin"))
        return Buffer.from("git@github.com:user/repo.git\n");
      if (command.includes("which gh")) throw new Error("not found");
      throw new Error(`Unmocked command: ${command}`);
    });

    const result = getGitContext("/repo");

    expect(result).toContain("gh CLI is not installed");
  });
});
