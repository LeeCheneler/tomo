import { afterEach, describe, expect, it, vi } from "vitest";
import type { AutocompleteItem } from "./autocomplete";
import { renderInk } from "../test-utils/ink";
import { keys } from "../test-utils/keys";
import { ChatInput, splitAtCursor } from "./chat-input";

const COLUMNS = 40;

/** Override process.stdout.columns for test predictability. */
function setColumns(width: number | undefined) {
  Object.defineProperty(process.stdout, "columns", {
    value: width,
    writable: true,
    configurable: true,
  });
}

describe("ChatInput", () => {
  afterEach(() => {
    setColumns(undefined);
  });

  /** Test autocomplete items. */
  const testItems: AutocompleteItem[] = [
    { name: "ping", description: "Responds with pong" },
    { name: "pong", description: "Responds with ping" },
    { name: "help", description: "Show help" },
  ];

  /** Test items exceeding MAX_VISIBLE (5). */
  const manyItems: AutocompleteItem[] = [
    { name: "aaa", description: "First" },
    { name: "bbb", description: "Second" },
    { name: "ccc", description: "Third" },
    { name: "ddd", description: "Fourth" },
    { name: "eee", description: "Fifth" },
    { name: "fff", description: "Sixth" },
    { name: "ggg", description: "Seventh" },
  ];

  /** Renders ChatInput with sensible defaults and a fixed terminal width. */
  function renderInput(
    overrides: Partial<{
      onMessage: (message: string) => void;
      onUp: () => void;
      initialValue: string;
      hasHistory: boolean;
      autocompleteItems: readonly AutocompleteItem[];
    }> = {},
  ) {
    setColumns(COLUMNS);

    return renderInk(
      <ChatInput
        onMessage={overrides.onMessage ?? (() => {})}
        onUp={overrides.onUp}
        initialValue={overrides.initialValue}
        hasHistory={overrides.hasHistory}
        autocompleteItems={overrides.autocompleteItems ?? []}
      />,
    );
  }

  describe("layout", () => {
    it("renders a top border at full terminal width", () => {
      const { lastFrame } = renderInput();
      const frame = lastFrame() ?? "";
      const lines = frame.split("\n");
      // paddingTop={1} adds an empty line before the border.
      expect(lines[1]).toBe("─".repeat(COLUMNS));
    });

    it("renders the prompt marker", () => {
      const { lastFrame } = renderInput();
      expect(lastFrame()).toContain("❯");
    });

    it("falls back to 80 columns when stdout.columns is undefined", () => {
      setColumns(undefined);

      const { lastFrame } = renderInk(
        <ChatInput onMessage={() => {}} autocompleteItems={[]} />,
      );

      const frame = lastFrame() ?? "";
      const lines = frame.split("\n");
      expect(lines[1]).toBe("─".repeat(80));
    });
  });

  describe("submit", () => {
    it("calls onMessage with value on enter", async () => {
      const onMessage = vi.fn();
      const { stdin } = renderInput({ onMessage });
      await stdin.write("hello");
      await stdin.write(keys.enter);
      expect(onMessage).toHaveBeenCalledWith("hello");
    });

    it("does not call onMessage when value is empty", async () => {
      const onMessage = vi.fn();
      const { stdin } = renderInput({ onMessage });
      await stdin.write(keys.enter);
      expect(onMessage).not.toHaveBeenCalled();
    });

    it("does not call onMessage when value is only whitespace", async () => {
      const onMessage = vi.fn();
      const { stdin } = renderInput({ onMessage });
      await stdin.write("   ");
      await stdin.write(keys.enter);
      expect(onMessage).not.toHaveBeenCalled();
    });

    it("clears input after submit so next submit requires new input", async () => {
      const onMessage = vi.fn();
      const { stdin } = renderInput({ onMessage });
      await stdin.write("hello");
      await stdin.write(keys.enter);
      await stdin.write(keys.enter);
      expect(onMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe("onUp", () => {
    it("calls onUp with current value when up arrow is pressed at cursor start", async () => {
      const onUp = vi.fn();
      const { stdin } = renderInput({ onUp });
      await stdin.write("my draft");
      await stdin.write(keys.up);
      // First up moves cursor to start, second up fires onUp.
      await stdin.write(keys.up);
      expect(onUp).toHaveBeenCalledWith("my draft");
    });

    it("calls onUp with empty string when input is empty", async () => {
      const onUp = vi.fn();
      const { stdin } = renderInput({ onUp });
      await stdin.write(keys.up);
      expect(onUp).toHaveBeenCalledWith("");
    });

    it("does not call onUp when cursor is not at start", async () => {
      const onUp = vi.fn();
      const { stdin } = renderInput({ onUp });
      await stdin.write("hello");
      await stdin.write(keys.up);
      expect(onUp).not.toHaveBeenCalled();
    });
  });

  describe("initialValue", () => {
    it("renders with initialValue text", () => {
      const { lastFrame } = renderInput({ initialValue: "hello world" });
      expect(lastFrame()).toContain("hello world");
    });

    it("defaults to empty when no initialValue provided", () => {
      const { lastFrame } = renderInput();
      const frame = lastFrame() ?? "";
      // Only the prompt marker and cursor placeholder should be between borders.
      expect(frame).not.toContain("hello");
    });
  });

  describe("instruction bar", () => {
    it("shows no instructions when input is empty", () => {
      const { lastFrame } = renderInput();
      const frame = lastFrame() ?? "";
      expect(frame).not.toContain("enter");
      expect(frame).not.toContain("escape");
    });

    it("does not show confirm after escape on empty input", async () => {
      const { stdin, lastFrame } = renderInput();
      await stdin.write(keys.escape);
      const frame = lastFrame() ?? "";
      expect(frame).not.toContain("confirm");
      expect(frame).not.toContain("escape");
    });

    it("shows enter submit and escape clear when input has content", async () => {
      const { stdin, lastFrame } = renderInput();
      await stdin.write("hello");
      const frame = lastFrame() ?? "";
      expect(frame).toContain("enter");
      expect(frame).toContain("submit");
      expect(frame).toContain("escape");
      expect(frame).toContain("clear");
    });

    it("switches escape instruction to confirm after first escape", async () => {
      const { stdin, lastFrame } = renderInput();
      await stdin.write("hello");
      await stdin.write(keys.escape);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("escape");
      expect(frame).toContain("confirm");
      expect(frame).not.toContain("clear");
    });

    it("reverts escape instruction to clear after second escape", async () => {
      const { stdin, lastFrame } = renderInput();
      await stdin.write("hello");
      await stdin.write(keys.escape);
      await stdin.write(keys.escape);
      const frame = lastFrame() ?? "";
      expect(frame).not.toContain("hello");
      expect(frame).not.toContain("escape");
    });

    it("reverts escape instruction to clear when user types", async () => {
      const { stdin, lastFrame } = renderInput();
      await stdin.write("hello");
      await stdin.write(keys.escape);
      await stdin.write("x");
      const frame = lastFrame() ?? "";
      expect(frame).toContain("hellox");
      expect(frame).toContain("escape");
      expect(frame).toContain("clear");
      expect(frame).not.toContain("confirm");
    });

    it("shows up history when hasHistory is true and cursor is at start", () => {
      const { lastFrame } = renderInput({ hasHistory: true });
      const frame = lastFrame() ?? "";
      expect(frame).toContain("up");
      expect(frame).toContain("history");
    });

    it("hides up history when cursor moves away from start", async () => {
      const { stdin, lastFrame } = renderInput({ hasHistory: true });
      await stdin.write("hello");
      const frame = lastFrame() ?? "";
      expect(frame).not.toContain("history");
    });

    it("shows up history again when cursor returns to start", async () => {
      const { stdin, lastFrame } = renderInput({ hasHistory: true });
      await stdin.write("hi");
      await stdin.write(keys.up);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("history");
    });

    it("does not show up history when hasHistory is false", () => {
      const { lastFrame } = renderInput();
      const frame = lastFrame() ?? "";
      expect(frame).not.toContain("history");
    });
  });

  describe("autocomplete", () => {
    it("shows autocomplete list when typing /", async () => {
      const { stdin, lastFrame } = renderInput({
        autocompleteItems: testItems,
      });
      await stdin.write("/");
      const frame = lastFrame() ?? "";
      expect(frame).toContain("/help");
      expect(frame).toContain("/ping");
      expect(frame).toContain("/pong");
    });

    it("filters autocomplete list as user types", async () => {
      const { stdin, lastFrame } = renderInput({
        autocompleteItems: testItems,
      });
      await stdin.write("/pi");
      const frame = lastFrame() ?? "";
      expect(frame).toContain("/ping");
      expect(frame).not.toContain("/help");
    });

    it("hides autocomplete after space", async () => {
      const { stdin, lastFrame } = renderInput({
        autocompleteItems: testItems,
      });
      await stdin.write("/ping");
      await stdin.write(" ");
      const frame = lastFrame() ?? "";
      expect(frame).not.toContain("Responds with pong");
    });

    it("does not show autocomplete for regular text", async () => {
      const { stdin, lastFrame } = renderInput({
        autocompleteItems: testItems,
      });
      await stdin.write("hello");
      expect(lastFrame()).not.toContain("/ping");
    });

    it("does not show autocomplete for // prefix", async () => {
      const { stdin, lastFrame } = renderInput({
        autocompleteItems: testItems,
      });
      await stdin.write("//");
      expect(lastFrame()).not.toContain("/ping");
    });

    it("navigates down through autocomplete with up/down", async () => {
      const { stdin, lastFrame } = renderInput({
        autocompleteItems: testItems,
      });
      await stdin.write("/");
      await stdin.write(keys.down);
      const frame = lastFrame() ?? "";
      // Items are sorted alphabetically: help, ping, pong.
      // Down from 0 selects index 1 (ping).
      expect(frame).toContain("/ping");
    });

    it("navigates up through autocomplete", async () => {
      const { stdin, lastFrame } = renderInput({
        autocompleteItems: testItems,
      });
      await stdin.write("/");
      await stdin.write(keys.down);
      await stdin.write(keys.up);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("/help");
    });

    it("loops autocomplete selection", async () => {
      const { stdin, lastFrame } = renderInput({
        autocompleteItems: testItems,
      });
      await stdin.write("/");
      // Up from index 0 loops to last (pong).
      await stdin.write(keys.up);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("/pong");
    });

    it("fills input with selected command on enter and appends space", async () => {
      const { stdin, lastFrame } = renderInput({
        autocompleteItems: testItems,
      });
      await stdin.write("/");
      // First item alphabetically is help.
      await stdin.write(keys.enter);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("/help");
      // Autocomplete should be dismissed (space appended).
      expect(frame).not.toContain("Show help");
    });

    it("shows navigate instruction when autocomplete is visible", async () => {
      const { stdin, lastFrame } = renderInput({
        autocompleteItems: testItems,
      });
      await stdin.write("/");
      const frame = lastFrame() ?? "";
      expect(frame).toContain("up/down");
      expect(frame).toContain("navigate");
    });

    it("shows select instead of submit when autocomplete is visible", async () => {
      const { stdin, lastFrame } = renderInput({
        autocompleteItems: testItems,
      });
      await stdin.write("/");
      const frame = lastFrame() ?? "";
      expect(frame).toContain("select");
      expect(frame).not.toContain("submit");
    });

    it("hides history instruction when autocomplete is visible", async () => {
      const { stdin, lastFrame } = renderInput({
        autocompleteItems: testItems,
        hasHistory: true,
      });
      await stdin.write("/");
      const frame = lastFrame() ?? "";
      expect(frame).not.toContain("history");
    });

    it("does not call onUp when autocomplete is visible", async () => {
      const onUp = vi.fn();
      const { stdin } = renderInput({
        onUp,
        autocompleteItems: testItems,
      });
      await stdin.write("/");
      await stdin.write(keys.up);
      expect(onUp).not.toHaveBeenCalled();
    });

    it("does not show autocomplete when no items provided", async () => {
      const { stdin, lastFrame } = renderInput();
      await stdin.write("/");
      const frame = lastFrame() ?? "";
      expect(frame).not.toContain("navigate");
    });

    it("does not show autocomplete when items array is empty", async () => {
      const { stdin, lastFrame } = renderInput({ autocompleteItems: [] });
      await stdin.write("/");
      const frame = lastFrame() ?? "";
      expect(frame).not.toContain("navigate");
    });

    it("submits normally when enter pressed with no matching autocomplete items", async () => {
      const onMessage = vi.fn();
      const { stdin } = renderInput({
        onMessage,
        autocompleteItems: testItems,
      });
      // Type a command that matches no items — autocomplete won't show.
      await stdin.write("/zzz ");
      await stdin.write(keys.enter);
      expect(onMessage).toHaveBeenCalledWith("/zzz ");
    });

    it("resets selection when filter changes", async () => {
      const { stdin, lastFrame } = renderInput({
        autocompleteItems: testItems,
      });
      await stdin.write("/");
      await stdin.write(keys.down);
      // Type more to change filter — selection should reset.
      await stdin.write("h");
      const frame = lastFrame() ?? "";
      // /help is the only match and should be at index 0.
      expect(frame).toContain("/help");
    });

    it("scrolls through all items with sliding window when more than 5 exist", async () => {
      const { stdin, lastFrame } = renderInput({
        autocompleteItems: manyItems,
      });
      await stdin.write("/");
      // 7 items: aaa-ggg. Down 5 times reaches fff (index 5).
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      const frame = lastFrame() ?? "";
      // Window should slide to show fff.
      expect(frame).toContain("/fff");
    });

    it("loops back to first item after scrolling past last", async () => {
      const { stdin, lastFrame } = renderInput({
        autocompleteItems: manyItems,
      });
      await stdin.write("/");
      // 7 items. Down 7 times loops back to aaa (index 0).
      for (let i = 0; i < 7; i++) {
        await stdin.write(keys.down);
      }
      const frame = lastFrame() ?? "";
      expect(frame).toContain("/aaa");
    });

    it("does nothing on down arrow when autocomplete is not visible", async () => {
      const { stdin, lastFrame } = renderInput();
      await stdin.write("hello");
      // Down at end of input — no autocomplete, should be a no-op.
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("hello");
      expect(frame).not.toContain("navigate");
    });
  });
});

describe("splitAtCursor", () => {
  it("splits at a normal character", () => {
    const result = splitAtCursor("hello", 2);
    expect(result).toEqual({ before: "he", at: "l", after: "lo" });
  });

  it("shows space placeholder at end of value", () => {
    const result = splitAtCursor("hello", 5);
    expect(result).toEqual({ before: "hello", at: " ", after: "" });
  });

  it("shows space placeholder on newline and preserves it in after", () => {
    const result = splitAtCursor("abc\ndef", 3);
    expect(result).toEqual({ before: "abc", at: " ", after: "\ndef" });
  });

  it("handles cursor at start", () => {
    const result = splitAtCursor("hello", 0);
    expect(result).toEqual({ before: "", at: "h", after: "ello" });
  });

  it("handles empty value", () => {
    const result = splitAtCursor("", 0);
    expect(result).toEqual({ before: "", at: " ", after: "" });
  });
});
