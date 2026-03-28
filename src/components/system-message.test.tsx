import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { SystemMessage } from "./system-message";

describe("SystemMessage", () => {
  it("renders command output text", () => {
    const { lastFrame } = render(
      <SystemMessage>{"Command executed successfully"}</SystemMessage>,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("Command executed successfully");
  });
});
