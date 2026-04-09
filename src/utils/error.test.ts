import { describe, expect, it } from "vitest";
import { getErrorMessage } from "./error";

describe("getErrorMessage", () => {
  it("returns message from Error instances", () => {
    expect(getErrorMessage(new Error("broken"))).toBe("broken");
  });

  it("returns generic message for string throws", () => {
    expect(getErrorMessage("string throw")).toBe("unknown error");
  });

  it("returns generic message for null", () => {
    expect(getErrorMessage(null)).toBe("unknown error");
  });

  it("returns generic message for undefined", () => {
    expect(getErrorMessage(undefined)).toBe("unknown error");
  });
});
