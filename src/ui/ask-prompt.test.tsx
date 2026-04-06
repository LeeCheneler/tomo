import { describe, expect, it, vi } from "vitest";
import { renderInk } from "../test-utils/ink";
import { keys } from "../test-utils/keys";
import { AskPrompt } from "./ask-prompt";

describe("AskPrompt", () => {
  describe("with options", () => {
    it("renders the question and options", () => {
      const { lastFrame } = renderInk(
        <AskPrompt
          question="Pick a color"
          options={["red", "blue"]}
          onResult={vi.fn()}
        />,
      );
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Pick a color");
      expect(frame).toContain("red");
      expect(frame).toContain("blue");
    });

    it("selects an option with enter", async () => {
      const onResult = vi.fn();
      const { stdin } = renderInk(
        <AskPrompt
          question="Pick one"
          options={["first", "second"]}
          onResult={onResult}
        />,
      );

      await stdin.write(keys.enter);
      expect(onResult).toHaveBeenCalledWith("first");
    });

    it("navigates options down with arrow keys", async () => {
      const onResult = vi.fn();
      const { stdin } = renderInk(
        <AskPrompt
          question="Pick one"
          options={["first", "second"]}
          onResult={onResult}
        />,
      );

      await stdin.write(keys.down);
      await stdin.write(keys.enter);
      expect(onResult).toHaveBeenCalledWith("second");
    });

    it("navigates options up with arrow keys (wraps around)", async () => {
      const onResult = vi.fn();
      const { stdin } = renderInk(
        <AskPrompt
          question="Pick one"
          options={["first", "second"]}
          onResult={onResult}
        />,
      );

      await stdin.write(keys.up);
      await stdin.write(keys.enter);
      expect(onResult).toHaveBeenCalledWith("second");
    });

    it("switches to text mode with tab", async () => {
      const onResult = vi.fn();
      const { stdin, lastFrame } = renderInk(
        <AskPrompt
          question="Pick one"
          options={["first"]}
          onResult={onResult}
        />,
      );

      await stdin.write(keys.tab);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("❯");
      // Options should no longer be rendered
      expect(frame).not.toContain("first");
    });

    it("submits typed text in text mode", async () => {
      const onResult = vi.fn();
      const { stdin } = renderInk(
        <AskPrompt
          question="Pick one"
          options={["first"]}
          onResult={onResult}
        />,
      );

      await stdin.write(keys.tab);
      await stdin.write("custom answer");
      await stdin.write(keys.enter);
      expect(onResult).toHaveBeenCalledWith("custom answer");
    });

    it("returns to options mode with escape from text mode", async () => {
      const { stdin, lastFrame } = renderInk(
        <AskPrompt
          question="Pick one"
          options={["first"]}
          onResult={vi.fn()}
        />,
      );

      await stdin.write(keys.tab);
      await stdin.write(keys.escape);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("first");
    });

    it("cancels with escape from option mode", async () => {
      const onResult = vi.fn();
      const { stdin } = renderInk(
        <AskPrompt
          question="Pick one"
          options={["first"]}
          onResult={onResult}
        />,
      );

      await stdin.write(keys.escape);
      expect(onResult).toHaveBeenCalledWith(null);
    });

    it("ignores unrecognised keys in option mode", async () => {
      const onResult = vi.fn();
      const { stdin } = renderInk(
        <AskPrompt
          question="Pick one"
          options={["first"]}
          onResult={onResult}
        />,
      );

      await stdin.write("x");
      expect(onResult).not.toHaveBeenCalled();
    });

    it("prevents double-fire on rapid selection", async () => {
      const onResult = vi.fn();
      const { stdin } = renderInk(
        <AskPrompt
          question="Pick one"
          options={["first"]}
          onResult={onResult}
        />,
      );

      await stdin.write(keys.enter);
      await stdin.write(keys.enter);
      expect(onResult).toHaveBeenCalledTimes(1);
    });
  });

  describe("without options", () => {
    it("renders a text input directly", () => {
      const { lastFrame } = renderInk(
        <AskPrompt question="What do you think?" onResult={vi.fn()} />,
      );
      const frame = lastFrame() ?? "";
      expect(frame).toContain("What do you think?");
      expect(frame).toContain("❯");
    });

    it("submits typed text with enter", async () => {
      const onResult = vi.fn();
      const { stdin } = renderInk(
        <AskPrompt question="Your name?" onResult={onResult} />,
      );

      await stdin.write("Lee");
      await stdin.write(keys.enter);
      expect(onResult).toHaveBeenCalledWith("Lee");
    });

    it("handles no-op key presses without error", async () => {
      const onResult = vi.fn();
      const { stdin } = renderInk(
        <AskPrompt question="Your name?" onResult={onResult} />,
      );

      // Left arrow at position 0 — no change to value or cursor
      await stdin.write(keys.left);
      expect(onResult).not.toHaveBeenCalled();
    });

    it("does not submit empty text", async () => {
      const onResult = vi.fn();
      const { stdin } = renderInk(
        <AskPrompt question="Your name?" onResult={onResult} />,
      );

      await stdin.write(keys.enter);
      expect(onResult).not.toHaveBeenCalled();
    });

    it("cancels with escape in text-only mode", async () => {
      const onResult = vi.fn();
      const { stdin } = renderInk(
        <AskPrompt question="Your name?" onResult={onResult} />,
      );

      await stdin.write(keys.escape);
      expect(onResult).toHaveBeenCalledWith(null);
    });
  });
});
