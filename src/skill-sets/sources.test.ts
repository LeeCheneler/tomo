import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  sourceSlug,
  findSkillSets,
  removeSource,
  sourceCacheDir,
} from "./sources";

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

describe("removeSource", () => {
  const testUrl = "git@github.com:org/test-remove.git";

  afterEach(() => {
    // Clean up in case test left the dir
    const dir = join(sourceCacheDir(), sourceSlug(testUrl));
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("removes an existing cached directory", () => {
    const dir = join(sourceCacheDir(), sourceSlug(testUrl));
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

describe("findSkillSets", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `tomo-test-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty for non-existent directory", () => {
    expect(findSkillSets("/does/not/exist", "test-url")).toEqual([]);
  });

  it("returns empty for directory with no skill sets", () => {
    mkdirSync(join(tmpDir, "random-dir"), { recursive: true });
    writeFileSync(join(tmpDir, "random-dir", "README.md"), "hello");
    expect(findSkillSets(tmpDir, "test-url")).toEqual([]);
  });

  it("discovers a skill set with name and description", () => {
    const setDir = join(tmpDir, "dev");
    mkdirSync(setDir, { recursive: true });
    writeFileSync(
      join(setDir, "tomo-skills.json"),
      JSON.stringify({ name: "dev", description: "Dev tools" }),
    );

    const sets = findSkillSets(tmpDir, "test-url");
    expect(sets).toEqual([
      {
        name: "dev",
        description: "Dev tools",
        path: setDir,
        sourceUrl: "test-url",
      },
    ]);
  });

  it("discovers a skill set with name only (no description)", () => {
    const setDir = join(tmpDir, "ops");
    mkdirSync(setDir, { recursive: true });
    writeFileSync(
      join(setDir, "tomo-skills.json"),
      JSON.stringify({ name: "ops" }),
    );

    const sets = findSkillSets(tmpDir, "test-url");
    expect(sets).toHaveLength(1);
    expect(sets[0].name).toBe("ops");
    expect(sets[0].description).toBe("");
  });

  it("discovers multiple skill sets", () => {
    for (const name of ["dev", "design", "ops"]) {
      const setDir = join(tmpDir, name);
      mkdirSync(setDir, { recursive: true });
      writeFileSync(join(setDir, "tomo-skills.json"), JSON.stringify({ name }));
    }

    const sets = findSkillSets(tmpDir, "test-url");
    expect(sets).toHaveLength(3);
    expect(sets.map((s) => s.name).sort()).toEqual(["design", "dev", "ops"]);
  });

  it("skips directories without tomo-skills.json", () => {
    // Has manifest
    const devDir = join(tmpDir, "dev");
    mkdirSync(devDir, { recursive: true });
    writeFileSync(
      join(devDir, "tomo-skills.json"),
      JSON.stringify({ name: "dev" }),
    );

    // No manifest
    mkdirSync(join(tmpDir, "docs"), { recursive: true });
    writeFileSync(join(tmpDir, "docs", "README.md"), "hello");

    const sets = findSkillSets(tmpDir, "test-url");
    expect(sets).toHaveLength(1);
    expect(sets[0].name).toBe("dev");
  });

  it("skips hidden directories", () => {
    const hiddenDir = join(tmpDir, ".git");
    mkdirSync(hiddenDir, { recursive: true });
    writeFileSync(
      join(hiddenDir, "tomo-skills.json"),
      JSON.stringify({ name: "hidden" }),
    );

    expect(findSkillSets(tmpDir, "test-url")).toEqual([]);
  });

  it("skips invalid JSON in tomo-skills.json", () => {
    const setDir = join(tmpDir, "bad");
    mkdirSync(setDir, { recursive: true });
    writeFileSync(join(setDir, "tomo-skills.json"), "not valid json{{{");

    expect(findSkillSets(tmpDir, "test-url")).toEqual([]);
  });

  it("skips tomo-skills.json missing name field", () => {
    const setDir = join(tmpDir, "no-name");
    mkdirSync(setDir, { recursive: true });
    writeFileSync(
      join(setDir, "tomo-skills.json"),
      JSON.stringify({ description: "no name here" }),
    );

    expect(findSkillSets(tmpDir, "test-url")).toEqual([]);
  });

  it("skips files (non-directories) in the root", () => {
    writeFileSync(join(tmpDir, "README.md"), "hello");
    writeFileSync(
      join(tmpDir, "tomo-skills.json"),
      JSON.stringify({ name: "root" }),
    );

    expect(findSkillSets(tmpDir, "test-url")).toEqual([]);
  });

  it("passes sourceUrl through to discovered sets", () => {
    const setDir = join(tmpDir, "dev");
    mkdirSync(setDir, { recursive: true });
    writeFileSync(
      join(setDir, "tomo-skills.json"),
      JSON.stringify({ name: "dev" }),
    );

    const url = "git@github.com:org/my-skills.git";
    const sets = findSkillSets(tmpDir, url);
    expect(sets[0].sourceUrl).toBe(url);
  });
});
