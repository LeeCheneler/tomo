import { describe, expect, it } from "vitest";
import { stripAnsi } from "./strip-ansi";

describe("stripAnsi", () => {
  it("returns plain text unchanged", () => {
    expect(stripAnsi("hello world")).toBe("hello world");
  });

  it("strips color codes", () => {
    expect(stripAnsi("\x1b[31mred\x1b[0m")).toBe("red");
  });

  it("strips bold and dim codes", () => {
    expect(stripAnsi("\x1b[1mbold\x1b[0m \x1b[2mdim\x1b[0m")).toBe("bold dim");
  });

  it("strips multiple codes in sequence", () => {
    expect(stripAnsi("\x1b[1m\x1b[31mbold red\x1b[0m")).toBe("bold red");
  });

  it("strips codes with compound parameters", () => {
    expect(stripAnsi("\x1b[38;5;196mextended color\x1b[0m")).toBe(
      "extended color",
    );
  });

  it("returns empty string for empty input", () => {
    expect(stripAnsi("")).toBe("");
  });
});
