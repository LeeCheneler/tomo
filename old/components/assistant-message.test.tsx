import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { AssistantMessage } from "./assistant-message";

describe("AssistantMessage", () => {
  it("renders content as markdown", () => {
    const { lastFrame } = render(
      <AssistantMessage>{"**bold text**"}</AssistantMessage>,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("bold text");
  });

  it("renders plain content", () => {
    const { lastFrame } = render(
      <AssistantMessage>{"Just content."}</AssistantMessage>,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("Just content.");
  });

  it("re-renders with updated content (streaming)", () => {
    const { lastFrame, rerender } = render(
      <AssistantMessage>{"Hello"}</AssistantMessage>,
    );
    expect(lastFrame() ?? "").toContain("Hello");

    rerender(
      <AssistantMessage>{"Hello, the answer is **42**."}</AssistantMessage>,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("42");
  });
});
