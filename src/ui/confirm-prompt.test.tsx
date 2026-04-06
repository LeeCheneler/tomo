import { describe, expect, it, vi } from "vitest";
import { renderInk } from "../test-utils/ink";
import { keys } from "../test-utils/keys";
import { ConfirmPrompt } from "./confirm-prompt";

describe("ConfirmPrompt", () => {
  it("renders approve and deny options with border", () => {
    const { lastFrame } = renderInk(<ConfirmPrompt onResult={() => {}} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("Approve");
    expect(frame).toContain("Deny");
    expect(frame).toContain("─");
  });

  it("shows key instructions", () => {
    const { lastFrame } = renderInk(<ConfirmPrompt onResult={() => {}} />);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("y");
    expect(frame).toContain("approve");
    expect(frame).toContain("n");
    expect(frame).toContain("deny");
  });

  it("calls onResult with true when y is pressed", async () => {
    const onResult = vi.fn();
    const { stdin } = renderInk(<ConfirmPrompt onResult={onResult} />);
    await stdin.write("y");
    expect(onResult).toHaveBeenCalledWith(true);
  });

  it("calls onResult with true when Y is pressed", async () => {
    const onResult = vi.fn();
    const { stdin } = renderInk(<ConfirmPrompt onResult={onResult} />);
    await stdin.write("Y");
    expect(onResult).toHaveBeenCalledWith(true);
  });

  it("calls onResult with false when n is pressed", async () => {
    const onResult = vi.fn();
    const { stdin } = renderInk(<ConfirmPrompt onResult={onResult} />);
    await stdin.write("n");
    expect(onResult).toHaveBeenCalledWith(false);
  });

  it("calls onResult with true when Approve is selected via enter", async () => {
    const onResult = vi.fn();
    const { stdin } = renderInk(<ConfirmPrompt onResult={onResult} />);
    // First item (Approve) is already selected
    await stdin.write(keys.enter);
    expect(onResult).toHaveBeenCalledWith(true);
  });

  it("calls onResult with false when Deny is selected via enter", async () => {
    const onResult = vi.fn();
    const { stdin } = renderInk(<ConfirmPrompt onResult={onResult} />);
    await stdin.write(keys.down);
    await stdin.write(keys.enter);
    expect(onResult).toHaveBeenCalledWith(false);
  });

  it("calls onResult with false on escape", async () => {
    const onResult = vi.fn();
    const { stdin } = renderInk(<ConfirmPrompt onResult={onResult} />);
    await stdin.write(keys.escape);
    expect(onResult).toHaveBeenCalledWith(false);
  });

  it("does not double-fire on rapid input", async () => {
    const onResult = vi.fn();
    const { stdin } = renderInk(<ConfirmPrompt onResult={onResult} />);
    await stdin.write("y");
    await stdin.write("n");
    expect(onResult).toHaveBeenCalledOnce();
  });
});
