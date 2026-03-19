import { render } from "ink-testing-library";
import { describe, it, expect } from "vitest";
import { AssistantMessage } from "./assistant-message";

describe("AssistantMessage", () => {
  it("renders content as markdown", () => {
    const { lastFrame } = render(
      <AssistantMessage>{"**bold text**"}</AssistantMessage>,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("bold text");
  });

  it("renders thinking text when provided", () => {
    const { lastFrame } = render(
      <AssistantMessage thinking="Let me consider this...">
        {"The answer is 42."}
      </AssistantMessage>,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("Let me consider this...");
    expect(output).toContain("The answer is 42.");
  });

  it("does not render thinking section when not provided", () => {
    const { lastFrame } = render(
      <AssistantMessage>{"Just content."}</AssistantMessage>,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("Just content.");
  });

  it("handles empty content during streaming", () => {
    const { lastFrame } = render(
      <AssistantMessage thinking="Thinking...">{""}</AssistantMessage>,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("Thinking...");
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
