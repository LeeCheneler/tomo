import { describe, expect, it } from "vitest";
import { renderInk } from "../test-utils/ink";
import { DiffView } from "./diff-view";

describe("DiffView", () => {
  it("renders addition lines", () => {
    const { lastFrame } = renderInk(<DiffView output={"+added line"} />);
    expect(lastFrame()).toContain("+added line");
  });

  it("renders removal lines", () => {
    const { lastFrame } = renderInk(<DiffView output={"-removed line"} />);
    expect(lastFrame()).toContain("-removed line");
  });

  it("renders hunk headers", () => {
    const { lastFrame } = renderInk(<DiffView output={"@@ -1,3 +1,3 @@"} />);
    expect(lastFrame()).toContain("@@ -1,3 +1,3 @@");
  });

  it("renders context lines", () => {
    const { lastFrame } = renderInk(<DiffView output={" unchanged line"} />);
    expect(lastFrame()).toContain("unchanged line");
  });

  it("renders multi-line diff output", () => {
    const diff = "@@ -1,3 +1,3 @@\n-old\n+new\n context";
    const { lastFrame } = renderInk(<DiffView output={diff} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("-old");
    expect(frame).toContain("+new");
    expect(frame).toContain("context");
  });
});
