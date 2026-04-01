import { afterEach, describe, expect, it } from "vitest";
import { renderInk } from "../test-utils/ink";
import { keys } from "../test-utils/keys";
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
    return renderInk(<Chat />);
  }

  describe("input mode", () => {
    it("renders ChatInput by default", () => {
      const { lastFrame } = renderChat();
      expect(lastFrame()).toContain("❯");
    });

    it("does not switch to history on up arrow when history is empty", async () => {
      const { stdin, lastFrame } = renderChat();
      await stdin.write(keys.up);
      expect(lastFrame()).toContain("❯");
    });
  });

  describe("message submission", () => {
    it("clears input after submitting a message", async () => {
      const { stdin, lastFrame } = renderChat();
      await stdin.write("hello");
      await stdin.write(keys.enter);
      const frame = lastFrame() ?? "";
      expect(frame).not.toContain("hello");
      expect(frame).toContain("❯");
    });
  });

  describe("history navigation", () => {
    it("switches to history mode on up arrow after submitting a message", async () => {
      const { stdin, lastFrame } = renderChat();
      await stdin.write("hello");
      await stdin.write(keys.enter);
      await stdin.write(keys.up);
      expect(lastFrame()).toContain("hello");
    });

    it("returns to input mode on exit from history", async () => {
      const { stdin, lastFrame } = renderChat();
      await stdin.write("hello");
      await stdin.write(keys.enter);
      await stdin.write(keys.up);
      await stdin.write(keys.escape);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("❯");
      expect(frame).not.toContain("hello");
    });

    it("loads selected entry into input on enter in history", async () => {
      const { stdin, lastFrame } = renderChat();
      await stdin.write("hello");
      await stdin.write(keys.enter);
      await stdin.write(keys.up);
      await stdin.write(keys.enter);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("❯");
      expect(frame).toContain("hello");
    });

    it("returns to empty input on exit via down arrow past last entry", async () => {
      const { stdin, lastFrame } = renderChat();
      await stdin.write("hello");
      await stdin.write(keys.enter);
      await stdin.write(keys.up);
      await stdin.write(keys.down);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("❯");
      expect(frame).not.toContain("hello");
    });
  });
});
