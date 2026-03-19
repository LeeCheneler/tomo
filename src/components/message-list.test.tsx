import { render } from "ink-testing-library";
import { describe, it, expect } from "vitest";
import { MessageList } from "./message-list";

describe("MessageList", () => {
  it("renders user and assistant messages", () => {
    const { lastFrame } = render(
      <MessageList
        messages={[
          { id: "1", role: "user", content: "Hi" },
          { id: "2", role: "assistant", content: "Hello!" },
        ]}
      />,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("Hi");
    expect(output).toContain("Hello!");
  });

  it("renders empty message list", () => {
    const { lastFrame } = render(<MessageList messages={[]} />);
    const output = lastFrame() ?? "";
    expect(output).toBe("");
  });

  it("renders multiple messages in order", () => {
    const { lastFrame } = render(
      <MessageList
        messages={[
          { id: "1", role: "user", content: "First" },
          { id: "2", role: "assistant", content: "Second" },
          { id: "3", role: "user", content: "Third" },
        ]}
      />,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("First");
    expect(output).toContain("Second");
    expect(output).toContain("Third");
  });
});
