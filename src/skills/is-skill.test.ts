import { describe, expect, it } from "vitest";
import { isSkill } from "./is-skill";

describe("isSkill", () => {
  it("returns true for a skill invocation", () => {
    expect(isSkill("//review")).toBe(true);
  });

  it("returns true for a skill with arguments", () => {
    expect(isSkill("//review check this function")).toBe(true);
  });

  it("returns false for a regular message", () => {
    expect(isSkill("hello world")).toBe(false);
  });

  it("returns false for an empty string", () => {
    expect(isSkill("")).toBe(false);
  });

  it("returns false for a single slash command", () => {
    expect(isSkill("/settings")).toBe(false);
  });

  it("returns false for bare double slash", () => {
    expect(isSkill("//")).toBe(false);
  });

  it("returns false for double slash followed by a space", () => {
    expect(isSkill("// something")).toBe(false);
  });

  it("returns false for triple slash", () => {
    expect(isSkill("///something")).toBe(false);
  });
});
