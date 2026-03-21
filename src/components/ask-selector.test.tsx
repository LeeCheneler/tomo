import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import { AskSelector } from "./ask-selector";

const flush = () => new Promise((r) => setTimeout(r, 50));

describe("AskSelector", () => {
  it("renders the question and options with an Other option", () => {
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
    expect(output).toContain("Other (type your answer)");
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

  it("enters text input mode when Other is selected", async () => {
    const onSelect = vi.fn();
    const { stdin, lastFrame } = render(
      <AskSelector
        question="Pick one"
        options={["A"]}
        onSelect={onSelect}
        onCancel={vi.fn()}
      />,
    );

    // Move down to "Other" (index 1), press Enter
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\r");
    await flush();

    // Should not have selected yet — should be in typing mode
    expect(onSelect).not.toHaveBeenCalled();

    // Type a custom answer
    stdin.write("custom answer");
    await flush();

    const output = lastFrame();
    expect(output).toContain("custom answer");

    // Press Enter to submit
    stdin.write("\r");
    await flush();

    expect(onSelect).toHaveBeenCalledWith("custom answer");
  });

  it("escape from typing mode returns to selection", async () => {
    const onCancel = vi.fn();
    const { stdin, lastFrame } = render(
      <AskSelector
        question="Pick"
        options={["A"]}
        onSelect={vi.fn()}
        onCancel={onCancel}
      />,
    );

    // Enter typing mode
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\r");
    await flush();
    stdin.write("partial");
    await flush();

    // Escape from typing mode — should not call onCancel
    stdin.write("\x1B");
    await flush();

    expect(onCancel).not.toHaveBeenCalled();
    // Should be back in selection mode, typing UI gone
    const output = lastFrame();
    expect(output).not.toContain("partial");
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

    // Enter typing mode
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\r");
    await flush();

    // Press Enter with empty input
    stdin.write("\r");
    await flush();

    expect(onSelect).not.toHaveBeenCalled();
  });

  it("supports backspace in typing mode", async () => {
    const onSelect = vi.fn();
    const { stdin } = render(
      <AskSelector
        question="Pick"
        options={["A"]}
        onSelect={onSelect}
        onCancel={vi.fn()}
      />,
    );

    // Enter typing mode
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\r");
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

    // Move up from first item — should wrap to last (Other)
    stdin.write("\x1B[A");
    await flush();
    // Move up again — should wrap to "B"
    stdin.write("\x1B[A");
    await flush();
    stdin.write("\r");
    await flush();

    expect(onSelect).toHaveBeenCalledWith("B");
  });
});
