import { render } from "ink-testing-library";
import { describe, it, expect } from "vitest";
import { UserMessage } from "./user-message";

describe("UserMessage", () => {
  it("renders the message content", () => {
    const { lastFrame } = render(
      <UserMessage>{"How does this work?"}</UserMessage>,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("How does this work?");
  });
});
