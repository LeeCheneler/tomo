import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import { AskSelector } from "./ask-selector";

const flush = () => new Promise((r) => setTimeout(r, 50));

describe("AskSelector", () => {
  it("renders the question, options, and a text input placeholder", () => {
    const { lastFrame } = render(
      <AskSelector
        question="Pick one"
        options={["A", "B"]}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const output = lastFrame();
    expect(output).toContain("Pick one");
    expect(output).toContain("A");
    expect(output).toContain("B");
    expect(output).toContain("Type your answer...");
  });

  it("calls onSelect with the chosen option on Enter", async () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <AskSelector
        question="Pick one"
        options={["A", "B"]}
        onSelect={onSelect}
        onCancel={vi.fn()}
      />,
    );

    // First option is selected by default, press Enter
    stdin.write("\r");
    await flush();

    expect(onSelect).toHaveBeenCalledWith("A");
  });

  it("navigates with arrow keys", async () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <AskSelector
        question="Pick one"
        options={["A", "B"]}
        onSelect={onSelect}
        onCancel={vi.fn()}
      />,
    );

    // Move down to "B", press Enter
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\r");
    await flush();

    expect(onSelect).toHaveBeenCalledWith("B");
  });

  it("calls onCancel on Escape", async () => {
    const onCancel = vi.fn();
    const { stdin } = render(
      <AskSelector
        question="Pick one"
        options={["A", "B"]}
        onSelect={vi.fn()}
        onCancel={onCancel}
      />,
    );

    stdin.write("\x1B"); // escape
    await flush();

    expect(onCancel).toHaveBeenCalled();
  });

  it("allows typing immediately when scrolled to text input", async () => {
    const onSelect = vi.fn();
    const { stdin, lastFrame } = render(
      <AskSelector
        question="Pick one"
        options={["A"]}
        onSelect={onSelect}
        onCancel={vi.fn()}
      />,
    );

    // Move down to text input (index 1) — typing starts immediately
    stdin.write("\x1B[B");
    await flush();

    // Type a custom answer — no Enter needed to activate
    stdin.write("custom answer");
    await flush();

    const output = lastFrame();
    expect(output).toContain("custom answer");

    // Press Enter to submit
    stdin.write("\r");
    await flush();

    expect(onSelect).toHaveBeenCalledWith("custom answer");
  });

  it("escape from text input clears text first, then cancels", async () => {
    const onCancel = vi.fn();
    const { stdin, lastFrame } = render(
      <AskSelector
        question="Pick"
        options={["A"]}
        onSelect={vi.fn()}
        onCancel={onCancel}
      />,
    );

    // Scroll to text input and type
    stdin.write("\x1B[B");
    await flush();
    stdin.write("partial");
    await flush();

    // First Escape clears the text
    stdin.write("\x1B");
    await flush();

    expect(onCancel).not.toHaveBeenCalled();
    const output = lastFrame();
    expect(output).not.toContain("partial");

    // Second Escape cancels
    stdin.write("\x1B");
    await flush();

    expect(onCancel).toHaveBeenCalled();
  });

  it("does not submit empty custom text", async () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <AskSelector
        question="Pick"
        options={["A"]}
        onSelect={onSelect}
        onCancel={vi.fn()}
      />,
    );

    // Scroll to text input
    stdin.write("\x1B[B");
    await flush();

    // Press Enter with empty input
    stdin.write("\r");
    await flush();

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("supports backspace in text input", async () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <AskSelector
        question="Pick"
        options={["A"]}
        onSelect={onSelect}
        onCancel={vi.fn()}
      />,
    );

    // Scroll to text input
    stdin.write("\x1B[B");
    await flush();

    stdin.write("abc");
    await flush();
    stdin.write("\x7F"); // backspace
    await flush();
    stdin.write("\r");
    await flush();

    expect(onSelect).toHaveBeenCalledWith("ab");
  });

  it("wraps cursor around when navigating past ends", async () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <AskSelector
        question="Pick"
        options={["A", "B"]}
        onSelect={onSelect}
        onCancel={vi.fn()}
      />,
    );

    // Move up from first item — should wrap to text input (index 2)
    stdin.write("\x1B[A");
    await flush();
    // Move up again — should wrap to "B" (index 1)
    stdin.write("\x1B[A");
    await flush();
    stdin.write("\r");
    await flush();

    expect(onSelect).toHaveBeenCalledWith("B");
  });

  it("renders text-only input when no options provided", () => {
    const { lastFrame } = render(
      <AskSelector
        question="What do you think?"
        options={[]}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const output = lastFrame();
    expect(output).toContain("What do you think?");
    // Cursor starts on the text input immediately (typing mode active)
    expect(output).toContain("❯");
  });

  it("allows typing immediately with no options", async () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <AskSelector
        question="What do you think?"
        options={[]}
        onSelect={onSelect}
        onCancel={vi.fn()}
      />,
    );

    // Cursor starts on text input — type immediately
    stdin.write("my answer");
    await flush();
    stdin.write("\r");
    await flush();

    expect(onSelect).toHaveBeenCalledWith("my answer");
  });

  it("preserves typed text when navigating away and back", async () => {
    const { stdin, lastFrame } = render(
      <AskSelector
        question="Pick"
        options={["A"]}
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    // Scroll to text input and type
    stdin.write("\x1B[B");
    await flush();
    stdin.write("hello");
    await flush();

    // Navigate up to option A
    stdin.write("\x1B[A");
    await flush();

    // Navigate back down to text input
    stdin.write("\x1B[B");
    await flush();

    const output = lastFrame();
    expect(output).toContain("hello");
  });
});
