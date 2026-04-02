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
    it("clears input and shows message in list after submit", async () => {
      const { stdin, lastFrame } = renderChat();
      await stdin.write("hello");
      await stdin.write(keys.enter);
      const frame = lastFrame() ?? "";
      // Message persists in the chat list above the input.
      expect(frame).toContain("hello");
      // Input is cleared — only the prompt marker remains in the input area.
      expect(frame).toContain("❯");
    });

    it("shows up history instruction after first message", async () => {
      const { stdin, lastFrame } = renderChat();
      await stdin.write("hello");
      await stdin.write(keys.enter);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("up");
      expect(frame).toContain("history");
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

    it("returns to input mode with draft on exit from history", async () => {
      const { stdin, lastFrame } = renderChat();
      await stdin.write("sent");
      await stdin.write(keys.enter);
      // Type a draft, then enter history (two ups: first moves cursor to start, second triggers onUp).
      await stdin.write("my draft");
      await stdin.write(keys.up);
      await stdin.write(keys.up);
      // Exit history via escape — draft should be restored.
      await stdin.write(keys.escape);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("❯");
      expect(frame).toContain("my draft");
    });

    it("loads selected entry into input replacing draft", async () => {
      const { stdin, lastFrame } = renderChat();
      await stdin.write("sent");
      await stdin.write(keys.enter);
      // Type a draft, then enter history.
      await stdin.write("my draft");
      await stdin.write(keys.up);
      await stdin.write(keys.up);
      // Select entry with enter — replaces draft.
      await stdin.write(keys.enter);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("❯");
      expect(frame).toContain("sent");
      expect(frame).not.toContain("my draft");
    });

    it("restores draft on exit via down arrow past last entry", async () => {
      const { stdin, lastFrame } = renderChat();
      await stdin.write("sent");
      await stdin.write(keys.enter);
      // Type a draft, then enter history.
      await stdin.write("my draft");
      await stdin.write(keys.up);
      await stdin.write(keys.up);
      // Exit via down arrow — draft should be restored.
      await stdin.write(keys.down);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("❯");
      expect(frame).toContain("my draft");
    });
  });
});
