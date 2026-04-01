import { render } from "ink-testing-library";
import { afterEach, describe, expect, it } from "vitest";
import { flushInkFrames } from "../test-utils/flush-ink";
import { Chat } from "./chat";

const COLUMNS = 40;

/** Override process.stdout.columns for test predictability. */
function setColumns(width: number | undefined) {
  Object.defineProperty(process.stdout, "columns", {
    value: width,
    writable: true,
    configurable: true,
  });
}

describe("Chat", () => {
  afterEach(() => {
    setColumns(undefined);
  });

  /** Renders Chat with a fixed terminal width. */
  function renderChat() {
    setColumns(COLUMNS);
    return render(<Chat />);
  }

  describe("input mode", () => {
    it("renders ChatInput by default", () => {
      const { lastFrame } = renderChat();
      // ChatInput shows the ❯ prompt marker.
      expect(lastFrame()).toContain("❯");
    });

    it("does not switch to history on up arrow when history is empty", () => {
      const { stdin, lastFrame } = renderChat();
      stdin.write("\x1b[A");
      // Still in input mode — ❯ prompt visible.
      expect(lastFrame()).toContain("❯");
    });
  });

  describe("message submission", () => {
    it("clears input after submitting a message", () => {
      const { stdin, lastFrame } = renderChat();
      stdin.write("hello");
      stdin.write("\r");
      const frame = lastFrame() ?? "";
      // Input should be cleared after submit.
      expect(frame).not.toContain("hello");
      expect(frame).toContain("❯");
    });
  });

  describe("history navigation", () => {
    it("switches to history mode on up arrow after submitting a message", async () => {
      const { stdin, lastFrame } = renderChat();
      stdin.write("hello");
      stdin.write("\r");
      stdin.write("\x1b[A");
      await flushInkFrames();
      // MessageHistory shows the submitted message.
      expect(lastFrame()).toContain("hello");
    });

    it("returns to input mode on exit from history", async () => {
      const { stdin, lastFrame } = renderChat();
      stdin.write("hello");
      stdin.write("\r");
      // Enter history mode.
      stdin.write("\x1b[A");
      await flushInkFrames();
      // Exit via escape.
      stdin.write("\x1b");
      await flushInkFrames();
      // Back in input mode with empty input.
      const frame = lastFrame() ?? "";
      expect(frame).toContain("❯");
      expect(frame).not.toContain("hello");
    });

    it("loads selected entry into input on enter in history", async () => {
      const { stdin, lastFrame } = renderChat();
      stdin.write("hello");
      stdin.write("\r");
      // Enter history mode.
      stdin.write("\x1b[A");
      await flushInkFrames();
      // Select entry with enter.
      stdin.write("\r");
      await flushInkFrames();
      // Back in input mode with the entry as initialValue.
      const frame = lastFrame() ?? "";
      expect(frame).toContain("❯");
      expect(frame).toContain("hello");
    });

    it("returns to empty input on exit via down arrow past last entry", async () => {
      const { stdin, lastFrame } = renderChat();
      stdin.write("hello");
      stdin.write("\r");
      // Enter history mode.
      stdin.write("\x1b[A");
      await flushInkFrames();
      // Exit via down arrow (already on last entry).
      stdin.write("\x1b[B");
      await flushInkFrames();
      // Back in input mode with empty input.
      const frame = lastFrame() ?? "";
      expect(frame).toContain("❯");
      expect(frame).not.toContain("hello");
    });
  });
});
