import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadSkills, parseSkillFile } from "./loader";

describe("parseSkillFile", () => {
  it("parses valid frontmatter and body", () => {
    const content = `---
name: commit
description: Commit changes
---

## Instructions

Do the thing.`;
    const skill = parseSkillFile(content, "commit", false);
    expect(skill).toEqual({
      name: "commit",
      description: "Commit changes",
      body: "## Instructions\n\nDo the thing.",
      local: false,
    });
  });

  it("uses directory name when frontmatter name is missing", () => {
    const content = `---
description: Review code
---

Review it.`;
    const skill = parseSkillFile(content, "review", true);
    expect(skill?.name).toBe("review");
    expect(skill?.local).toBe(true);
  });

  it("returns empty description when not provided", () => {
    const content = `---
name: deploy
---

Deploy it.`;
    const skill = parseSkillFile(content, "deploy", false);
    expect(skill?.description).toBe("");
  });

  it("returns null for content without frontmatter", () => {
    const result = parseSkillFile("Just some markdown", "test", false);
    expect(result).toBeNull();
  });

  it("returns null for empty frontmatter", () => {
    const content = `---
---

Body`;
    const result = parseSkillFile(content, "", false);
    expect(result).toBeNull();
  });

  it("frontmatter name overrides directory name", () => {
    const content = `---
name: custom-name
description: A skill
---

Body.`;
    const skill = parseSkillFile(content, "dir-name", false);
    expect(skill?.name).toBe("custom-name");
  });

  it("marks skill as local when local flag is true", () => {
    const content = `---
name: local-skill
description: Local
---

Body.`;
    const skill = parseSkillFile(content, "local-skill", true);
    expect(skill?.local).toBe(true);
  });
});

describe("loadSkills", () => {
  const testDir = join(tmpdir(), `tomo-skills-test-${Date.now()}`);
  const globalDir = join(testDir, "global");
  const localDir = join(testDir, "local");

  beforeEach(() => {
    mkdirSync(globalDir, { recursive: true });
    mkdirSync(localDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  function writeSkill(baseDir: string, name: string, content: string): void {
    const dir = join(baseDir, name);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "SKILL.md"), content, "utf-8");
  }

  it("loads skills from global directory", () => {
    writeSkill(
      globalDir,
      "commit",
      `---
name: commit
description: Commit changes
---

Instructions here.`,
    );

    const skills = loadSkills(globalDir, localDir);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("commit");
    expect(skills[0].local).toBe(false);
  });

  it("loads skills from local directory with (local) prefix", () => {
    writeSkill(
      localDir,
      "review",
      `---
name: review
description: Review code
---

Review instructions.`,
    );

    const skills = loadSkills(globalDir, localDir);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("review");
    expect(skills[0].description).toBe("(local) Review code");
    expect(skills[0].local).toBe(true);
  });

  it("local skills shadow global skills with same name", () => {
    writeSkill(
      globalDir,
      "commit",
      `---
name: commit
description: Global commit
---

Global body.`,
    );

    writeSkill(
      localDir,
      "commit",
      `---
name: commit
description: Local commit
---

Local body.`,
    );

    const skills = loadSkills(globalDir, localDir);
    expect(skills).toHaveLength(1);
    expect(skills[0].description).toBe("(local) Local commit");
    expect(skills[0].body).toBe("Local body.");
    expect(skills[0].local).toBe(true);
  });

  it("returns both global and local skills with different names", () => {
    writeSkill(
      globalDir,
      "commit",
      `---
name: commit
description: Commit
---

Commit body.`,
    );

    writeSkill(
      localDir,
      "review",
      `---
name: review
description: Review
---

Review body.`,
    );

    const skills = loadSkills(globalDir, localDir);
    expect(skills).toHaveLength(2);
    const names = skills.map((s) => s.name).sort();
    expect(names).toEqual(["commit", "review"]);
  });

  it("skips directories without SKILL.md", () => {
    mkdirSync(join(globalDir, "empty-dir"), { recursive: true });

    const skills = loadSkills(globalDir, localDir);
    expect(skills).toHaveLength(0);
  });

  it("skips files with invalid frontmatter", () => {
    writeSkill(globalDir, "broken", "No frontmatter here");

    const skills = loadSkills(globalDir, localDir);
    expect(skills).toHaveLength(0);
  });

  it("returns empty array when no skills directories exist", () => {
    rmSync(testDir, { recursive: true, force: true });

    const skills = loadSkills(globalDir, localDir);
    expect(skills).toHaveLength(0);
  });
});
