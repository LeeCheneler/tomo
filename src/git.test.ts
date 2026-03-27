import { describe, expect, it, vi } from "vitest";
import { execSync } from "node:child_process";
import {
  isGitRepo,
  getGitBranch,
  getDefaultBranch,
  getGitStatusSummary,
  getGitLog,
  getGitRemoteUrl,
  isGitHubRemote,
  isGhCliAvailable,
} from "./git";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

const mockExecSync = vi.mocked(execSync);

describe("isGitRepo", () => {
  it("returns true when git rev-parse succeeds", () => {
    mockExecSync.mockReturnValue(Buffer.from("true\n"));
    expect(isGitRepo("/some/dir")).toBe(true);
  });

  it("returns false when git rev-parse throws", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not a git repo");
    });
    expect(isGitRepo("/tmp")).toBe(false);
  });
});

describe("getGitBranch", () => {
  it("returns the current branch name", () => {
    mockExecSync.mockReturnValue(Buffer.from("feat/my-feature\n"));
    expect(getGitBranch("/some/dir")).toBe("feat/my-feature");
  });

  it("handles branch names with slashes", () => {
    mockExecSync.mockReturnValue(Buffer.from("fix/deep/nested/branch\n"));
    expect(getGitBranch("/some/dir")).toBe("fix/deep/nested/branch");
  });
});

describe("getDefaultBranch", () => {
  it("extracts branch name from symbolic ref", () => {
    mockExecSync.mockReturnValue(Buffer.from("refs/remotes/origin/develop\n"));
    expect(getDefaultBranch("/some/dir")).toBe("develop");
  });

  it("returns main as fallback when symbolic-ref fails", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("no remote");
    });
    expect(getDefaultBranch("/some/dir")).toBe("main");
  });

  it("handles main branch correctly", () => {
    mockExecSync.mockReturnValue(Buffer.from("refs/remotes/origin/main\n"));
    expect(getDefaultBranch("/some/dir")).toBe("main");
  });
});

describe("getGitStatusSummary", () => {
  it('returns "clean" when no changes', () => {
    mockExecSync.mockReturnValue(Buffer.from(""));
    expect(getGitStatusSummary("/some/dir")).toBe("clean");
  });

  it("returns singular for one changed file", () => {
    mockExecSync.mockReturnValue(Buffer.from(" M src/index.ts\n"));
    expect(getGitStatusSummary("/some/dir")).toBe("1 changed file");
  });

  it("returns plural for multiple changed files", () => {
    mockExecSync.mockReturnValue(
      Buffer.from(" M src/index.ts\n M src/app.ts\n?? new-file.ts\n"),
    );
    expect(getGitStatusSummary("/some/dir")).toBe("3 changed files");
  });
});

describe("getGitLog", () => {
  it("returns oneline log output", () => {
    const log = "abc1234 feat: add feature\ndef5678 fix: fix bug";
    mockExecSync.mockReturnValue(Buffer.from(`${log}\n`));
    expect(getGitLog("/some/dir")).toBe(log);
  });

  it("passes count parameter", () => {
    mockExecSync.mockReturnValue(Buffer.from("abc1234 commit\n"));
    getGitLog("/some/dir", 5);
    expect(mockExecSync).toHaveBeenCalledWith("git log --oneline -5", {
      cwd: "/some/dir",
      stdio: "pipe",
    });
  });

  it("defaults to 10 commits", () => {
    mockExecSync.mockReturnValue(Buffer.from("abc1234 commit\n"));
    getGitLog("/some/dir");
    expect(mockExecSync).toHaveBeenCalledWith("git log --oneline -10", {
      cwd: "/some/dir",
      stdio: "pipe",
    });
  });
});

describe("getGitRemoteUrl", () => {
  it("returns the origin URL", () => {
    mockExecSync.mockReturnValue(Buffer.from("git@github.com:user/repo.git\n"));
    expect(getGitRemoteUrl("/some/dir")).toBe("git@github.com:user/repo.git");
  });

  it("returns HTTPS URLs", () => {
    mockExecSync.mockReturnValue(
      Buffer.from("https://github.com/user/repo.git\n"),
    );
    expect(getGitRemoteUrl("/some/dir")).toBe(
      "https://github.com/user/repo.git",
    );
  });

  it("returns null when no remote configured", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("No remote");
    });
    expect(getGitRemoteUrl("/some/dir")).toBeNull();
  });
});

describe("isGitHubRemote", () => {
  it("returns true for SSH GitHub URLs", () => {
    mockExecSync.mockReturnValue(Buffer.from("git@github.com:user/repo.git\n"));
    expect(isGitHubRemote("/some/dir")).toBe(true);
  });

  it("returns true for HTTPS GitHub URLs", () => {
    mockExecSync.mockReturnValue(
      Buffer.from("https://github.com/user/repo.git\n"),
    );
    expect(isGitHubRemote("/some/dir")).toBe(true);
  });

  it("returns false for non-GitHub remotes", () => {
    mockExecSync.mockReturnValue(Buffer.from("git@gitlab.com:user/repo.git\n"));
    expect(isGitHubRemote("/some/dir")).toBe(false);
  });

  it("returns false when no remote configured", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("No remote");
    });
    expect(isGitHubRemote("/some/dir")).toBe(false);
  });
});

describe("isGhCliAvailable", () => {
  it("returns true when gh is on PATH", () => {
    mockExecSync.mockReturnValue(Buffer.from("/usr/local/bin/gh\n"));
    expect(isGhCliAvailable()).toBe(true);
  });

  it("returns false when gh is not found", () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("not found");
    });
    expect(isGhCliAvailable()).toBe(false);
  });
});
