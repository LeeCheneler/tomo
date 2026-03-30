import { describe, expect, it } from "vitest";
import { stripAnsi } from "./strip-ansi";

describe("stripAnsi", () => {
  it("removes ANSI color codes", () => {
    expect(stripAnsi("\x1b[31mred\x1b[0m")).toBe("red");
  });

  it("removes bold/dim codes", () => {
    expect(stripAnsi("\x1b[1m\x1b[33mBold Yellow\x1b[39m\x1b[22m")).toBe(
      "Bold Yellow",
    );
  });

  it("returns plain strings unchanged", () => {
    expect(stripAnsi("no codes here")).toBe("no codes here");
  });

  it("handles per-character coloring from biome", () => {
    const biomeStyle = "\x1b[0m\x1b[0mP\x1b[0m\x1b[0mr\x1b[0m\x1b[0me\x1b[0m";
    expect(stripAnsi(biomeStyle)).toBe("Pre");
  });

  it("handles empty string", () => {
    expect(stripAnsi("")).toBe("");
  });
});
