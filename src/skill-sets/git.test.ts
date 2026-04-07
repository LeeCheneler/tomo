import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  cloneSource,
  pullSource,
  removeSource,
  skillSetsDir,
  sourceDir,
  sourceSlug,
} from "./git";

describe("sourceSlug", () => {
  it("generates a stable slug for a git SSH URL", () => {
    const slug = sourceSlug("git@github.com:org/repo.git");
    expect(slug).toMatch(/^org-repo-[a-f0-9]{12}$/);
  });

  it("generates a stable slug for an HTTPS URL", () => {
    const slug = sourceSlug("https://github.com/org/repo.git");
    expect(slug).toMatch(/^org-repo-[a-f0-9]{12}$/);
  });

  it("generates different slugs for different URLs", () => {
    const a = sourceSlug("git@github.com:org/repo-a.git");
    const b = sourceSlug("git@github.com:org/repo-b.git");
    expect(a).not.toBe(b);
  });

  it("generates same slug for same URL", () => {
    const url = "git@github.com:org/repo.git";
    expect(sourceSlug(url)).toBe(sourceSlug(url));
  });
});

describe("sourceDir", () => {
  it("returns path under skill sets directory", () => {
    const dir = sourceDir("git@github.com:org/repo.git");
    expect(dir).toContain(skillSetsDir());
    expect(dir).toContain(sourceSlug("git@github.com:org/repo.git"));
  });
});

describe("removeSource", () => {
  const testUrl = "git@github.com:org/test-remove.git";

  afterEach(() => {
    const dir = sourceDir(testUrl);
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("removes an existing cached directory", () => {
    const dir = sourceDir(testUrl);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "marker"), "test");

    expect(existsSync(dir)).toBe(true);
    removeSource(testUrl);
    expect(existsSync(dir)).toBe(false);
  });

  it("does nothing for non-existent source", () => {
    removeSource("git@github.com:nonexistent/repo.git");
  });
});

describe("cloneSource", () => {
  let bareRepo: string;
  let bareRepoUrl: string;

  beforeEach(() => {
    bareRepo = join(tmpdir(), `tomo-test-bare-${Date.now()}`);
    mkdirSync(bareRepo, { recursive: true });
    execFileSync("git", ["init", "--bare", bareRepo], { stdio: "pipe" });

    // Create a temporary working repo, commit a file, and push to the bare repo.
    const workDir = join(tmpdir(), `tomo-test-work-${Date.now()}`);
    mkdirSync(workDir, { recursive: true });
    execFileSync("git", ["init", workDir], { stdio: "pipe" });
    execFileSync("git", ["checkout", "-b", "main"], {
      cwd: workDir,
      stdio: "pipe",
    });
    writeFileSync(join(workDir, "README.md"), "hello");
    execFileSync("git", ["add", "."], { cwd: workDir, stdio: "pipe" });
    execFileSync(
      "git",
      [
        "-c",
        "user.email=test@test.com",
        "-c",
        "user.name=Test",
        "commit",
        "-m",
        "init",
      ],
      { cwd: workDir, stdio: "pipe" },
    );
    execFileSync("git", ["remote", "add", "origin", bareRepo], {
      cwd: workDir,
      stdio: "pipe",
    });
    execFileSync("git", ["push", "origin", "main"], {
      cwd: workDir,
      stdio: "pipe",
    });
    rmSync(workDir, { recursive: true, force: true });

    bareRepoUrl = bareRepo;
  });

  afterEach(() => {
    removeSource(bareRepoUrl);
    if (existsSync(bareRepo)) {
      rmSync(bareRepo, { recursive: true, force: true });
    }
  });

  it("clones a repo and returns the local path", () => {
    const dir = cloneSource(bareRepoUrl);
    expect(existsSync(join(dir, ".git"))).toBe(true);
    expect(existsSync(join(dir, "README.md"))).toBe(true);
  });

  it("returns existing path if already cloned", () => {
    const first = cloneSource(bareRepoUrl);
    const second = cloneSource(bareRepoUrl);
    expect(first).toBe(second);
  });

  it("cleans up on clone failure and rethrows", () => {
    const badUrl = "/nonexistent/repo.git";
    expect(() => cloneSource(badUrl)).toThrow();
    expect(existsSync(sourceDir(badUrl))).toBe(false);
  });

  it("cleans up partial directory on clone failure", () => {
    const badUrl = "/nonexistent/partial-clone.git";
    const dir = sourceDir(badUrl);
    // Pre-create the directory to simulate a partial clone that left a dir behind.
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "partial"), "leftover");
    expect(() => cloneSource(badUrl)).toThrow();
    expect(existsSync(dir)).toBe(false);
  });
});

describe("pullSource", () => {
  let bareRepo: string;
  let bareRepoUrl: string;

  beforeEach(() => {
    bareRepo = join(tmpdir(), `tomo-test-bare-${Date.now()}`);
    mkdirSync(bareRepo, { recursive: true });
    execFileSync("git", ["init", "--bare", bareRepo], { stdio: "pipe" });

    const workDir = join(tmpdir(), `tomo-test-work-${Date.now()}`);
    mkdirSync(workDir, { recursive: true });
    execFileSync("git", ["init", workDir], { stdio: "pipe" });
    execFileSync("git", ["checkout", "-b", "main"], {
      cwd: workDir,
      stdio: "pipe",
    });
    writeFileSync(join(workDir, "README.md"), "v1");
    execFileSync("git", ["add", "."], { cwd: workDir, stdio: "pipe" });
    execFileSync(
      "git",
      [
        "-c",
        "user.email=test@test.com",
        "-c",
        "user.name=Test",
        "commit",
        "-m",
        "init",
      ],
      { cwd: workDir, stdio: "pipe" },
    );
    execFileSync("git", ["remote", "add", "origin", bareRepo], {
      cwd: workDir,
      stdio: "pipe",
    });
    execFileSync("git", ["push", "origin", "main"], {
      cwd: workDir,
      stdio: "pipe",
    });
    rmSync(workDir, { recursive: true, force: true });

    bareRepoUrl = bareRepo;
  });

  afterEach(() => {
    removeSource(bareRepoUrl);
    if (existsSync(bareRepo)) {
      rmSync(bareRepo, { recursive: true, force: true });
    }
  });

  it("pulls latest changes into a cloned repo", () => {
    cloneSource(bareRepoUrl);

    // Push a new commit to the bare repo via a temp working copy.
    const workDir = join(tmpdir(), `tomo-test-update-${Date.now()}`);
    execFileSync("git", ["clone", bareRepo, workDir], { stdio: "pipe" });
    writeFileSync(join(workDir, "NEW.md"), "new file");
    execFileSync("git", ["add", "."], { cwd: workDir, stdio: "pipe" });
    execFileSync(
      "git",
      [
        "-c",
        "user.email=test@test.com",
        "-c",
        "user.name=Test",
        "commit",
        "-m",
        "add new",
      ],
      { cwd: workDir, stdio: "pipe" },
    );
    execFileSync("git", ["push", "origin", "main"], {
      cwd: workDir,
      stdio: "pipe",
    });
    rmSync(workDir, { recursive: true, force: true });

    pullSource(bareRepoUrl);
    expect(existsSync(join(sourceDir(bareRepoUrl), "NEW.md"))).toBe(true);
  });

  it("does nothing for non-existent clone", () => {
    pullSource("git@github.com:nonexistent/repo.git");
  });
});
