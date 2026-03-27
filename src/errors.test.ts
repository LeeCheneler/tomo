import { describe, expect, it } from "vitest";
import { getErrorMessage } from "./errors";

describe("getErrorMessage", () => {
  it("extracts message from Error instances", () => {
    expect(getErrorMessage(new Error("boom"))).toBe("boom");
  });

  it("extracts message from Error subclasses", () => {
    expect(getErrorMessage(new TypeError("bad type"))).toBe("bad type");
  });

  it("converts strings to themselves", () => {
    expect(getErrorMessage("something broke")).toBe("something broke");
  });

  it("converts numbers to string", () => {
    expect(getErrorMessage(42)).toBe("42");
  });

  it("converts null to string", () => {
    expect(getErrorMessage(null)).toBe("null");
  });

  it("converts undefined to string", () => {
    expect(getErrorMessage(undefined)).toBe("undefined");
  });

  it("converts objects to string", () => {
    expect(getErrorMessage({ code: 500 })).toBe("[object Object]");
  });
});
