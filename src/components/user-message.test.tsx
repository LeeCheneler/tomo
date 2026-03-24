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

  it("shows image count when images are attached", () => {
    const { lastFrame } = render(
      <UserMessage imageCount={2}>{"describe these"}</UserMessage>,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("describe these");
    expect(output).toContain("2 images");
  });

  it("shows singular image label for one image", () => {
    const { lastFrame } = render(
      <UserMessage imageCount={1}>{"what is this?"}</UserMessage>,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("1 image");
    expect(output).not.toContain("images");
  });

  it("shows no image label when imageCount is undefined", () => {
    const { lastFrame } = render(<UserMessage>{"just text"}</UserMessage>);
    const output = lastFrame() ?? "";
    expect(output).not.toContain("image");
  });
});
