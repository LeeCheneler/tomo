import { describe, expect, it } from "vitest";
import { formatToolResultForLlm } from "./tool-result-format";

describe("formatToolResultForLlm", () => {
  it("returns plain success output verbatim", () => {
    expect(formatToolResultForLlm("hello world", "ok", "plain")).toBe(
      "hello world",
    );
  });

  it("returns empty plain success output verbatim", () => {
    expect(formatToolResultForLlm("", "ok", "plain")).toBe("");
  });

  it("returns a plain result that contains the word 'error' verbatim (no spurious remapping)", () => {
    expect(
      formatToolResultForLlm("No error reported by the linter.", "ok", "plain"),
    ).toBe("No error reported by the linter.");
  });

  it("prepends a natural-language preamble to diff-formatted successes", () => {
    const diff = "@@ -1 +1 @@\n-old\n+new";
    expect(formatToolResultForLlm(diff, "ok", "diff")).toBe(
      `Edit applied successfully. Unified diff:\n${diff}`,
    );
  });

  it("prefixes errors with 'ERROR:' regardless of format", () => {
    expect(formatToolResultForLlm("file not found", "error", "plain")).toBe(
      "ERROR: file not found",
    );
    expect(
      formatToolResultForLlm("edit 1: oldString not found", "error", "diff"),
    ).toBe("ERROR: edit 1: oldString not found");
  });

  it("prefixes denials with 'DENIED:' regardless of format", () => {
    expect(
      formatToolResultForLlm("The user denied this edit.", "denied", "plain"),
    ).toBe("DENIED: The user denied this edit.");
    expect(formatToolResultForLlm("rejected", "denied", "diff")).toBe(
      "DENIED: rejected",
    );
  });

  it("error prefix wins over diff preamble when status is error and format is diff", () => {
    expect(formatToolResultForLlm("@@ -1 +1 @@", "error", "diff")).toBe(
      "ERROR: @@ -1 +1 @@",
    );
  });
});
