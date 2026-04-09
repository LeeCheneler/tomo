import type { Key } from "ink";
import { describe, expect, it } from "vitest";
import { processTextEdit } from "./text-edit";

/** Builds a Key object with all fields defaulted to false. */
function key(overrides: Partial<Key> = {}): Key {
  return {
    upArrow: false,
    downArrow: false,
    leftArrow: false,
    rightArrow: false,
    pageDown: false,
    pageUp: false,
    home: false,
    end: false,
    return: false,
    escape: false,
    ctrl: false,
    shift: false,
    tab: false,
    backspace: false,
    delete: false,
    meta: false,
    super: false,
    hyper: false,
    capsLock: false,
    numLock: false,
    ...overrides,
  };
}

describe("processTextEdit", () => {
  describe("character insertion", () => {
    it("inserts at end", () => {
      expect(processTextEdit("x", key(), "hello", 5)).toEqual({
        value: "hellox",
        cursor: 6,
      });
    });

    it("inserts in the middle", () => {
      expect(processTextEdit("X", key(), "hello", 2)).toEqual({
        value: "heXllo",
        cursor: 3,
      });
    });

    it("inserts at start", () => {
      expect(processTextEdit("X", key(), "hello", 0)).toEqual({
        value: "Xhello",
        cursor: 1,
      });
    });

    it("strips newlines in single-line mode", () => {
      expect(processTextEdit("a\nb\nc", key(), "hello", 5)).toEqual({
        value: "helloabc",
        cursor: 8,
      });
    });

    it("no-ops when input is only newlines in single-line mode", () => {
      expect(processTextEdit("\n", key(), "hello", 5)).toEqual({
        value: "hello",
        cursor: 5,
      });
    });
  });

  describe("backspace", () => {
    it("deletes before cursor", () => {
      expect(processTextEdit("", key({ backspace: true }), "hello", 5)).toEqual(
        { value: "hell", cursor: 4 },
      );
    });

    it("no-ops at start", () => {
      expect(processTextEdit("", key({ backspace: true }), "hello", 0)).toEqual(
        { value: "hello", cursor: 0 },
      );
    });

    it("handles delete key", () => {
      expect(processTextEdit("", key({ delete: true }), "hello", 3)).toEqual({
        value: "helo",
        cursor: 2,
      });
    });
  });

  describe("cursor movement", () => {
    it("moves left", () => {
      expect(processTextEdit("", key({ leftArrow: true }), "hello", 3)).toEqual(
        { value: "hello", cursor: 2 },
      );
    });

    it("clamps left at 0", () => {
      expect(processTextEdit("", key({ leftArrow: true }), "hello", 0)).toEqual(
        { value: "hello", cursor: 0 },
      );
    });

    it("moves right", () => {
      expect(
        processTextEdit("", key({ rightArrow: true }), "hello", 3),
      ).toEqual({ value: "hello", cursor: 4 });
    });

    it("clamps right at length", () => {
      expect(
        processTextEdit("", key({ rightArrow: true }), "hello", 5),
      ).toEqual({ value: "hello", cursor: 5 });
    });
  });

  describe("word jump", () => {
    it("jumps backward with meta+left", () => {
      expect(
        processTextEdit(
          "",
          key({ meta: true, leftArrow: true }),
          "hello world",
          8,
        ),
      ).toEqual({ value: "hello world", cursor: 6 });
    });

    it("jumps backward with meta+b", () => {
      expect(
        processTextEdit("b", key({ meta: true }), "hello world", 8),
      ).toEqual({ value: "hello world", cursor: 6 });
    });

    it("jumps forward with meta+right", () => {
      expect(
        processTextEdit(
          "",
          key({ meta: true, rightArrow: true }),
          "hello world",
          0,
        ),
      ).toEqual({ value: "hello world", cursor: 5 });
    });

    it("jumps forward with meta+f", () => {
      expect(
        processTextEdit("f", key({ meta: true }), "hello world", 0),
      ).toEqual({ value: "hello world", cursor: 5 });
    });
  });

  describe("word delete", () => {
    it("deletes backward with meta+backspace", () => {
      expect(
        processTextEdit(
          "",
          key({ meta: true, backspace: true }),
          "hello world",
          11,
        ),
      ).toEqual({ value: "hello ", cursor: 6 });
    });

    it("no-ops backward at start", () => {
      expect(
        processTextEdit("", key({ meta: true, backspace: true }), "hello", 0),
      ).toEqual({ value: "hello", cursor: 0 });
    });

    it("deletes forward with meta+d", () => {
      expect(
        processTextEdit("d", key({ meta: true }), "hello world", 0),
      ).toEqual({ value: " world", cursor: 0 });
    });

    it("no-ops forward at end", () => {
      expect(processTextEdit("d", key({ meta: true }), "hello", 5)).toEqual({
        value: "hello",
        cursor: 5,
      });
    });
  });

  describe("multi-line mode", () => {
    const multi = { lineMode: "multi" as const };

    it("inserts newline on shift+enter", () => {
      expect(
        processTextEdit(
          "",
          key({ return: true, shift: true }),
          "hello",
          5,
          multi,
        ),
      ).toEqual({ value: "hello\n", cursor: 6 });
    });

    it("inserts newline at cursor position", () => {
      expect(
        processTextEdit(
          "",
          key({ return: true, shift: true }),
          "hello",
          3,
          multi,
        ),
      ).toEqual({ value: "hel\nlo", cursor: 4 });
    });

    it("returns null for plain enter in multi mode", () => {
      expect(
        processTextEdit("", key({ return: true }), "hello", 5, multi),
      ).toBeNull();
    });

    it("returns null for shift+enter in single mode", () => {
      expect(
        processTextEdit("", key({ return: true, shift: true }), "hello", 5),
      ).toBeNull();
    });

    it("up arrow moves to same column on previous line", () => {
      expect(
        processTextEdit("", key({ upArrow: true }), "abc\ndef", 7, multi),
      ).toEqual({ value: "abc\ndef", cursor: 3 });
    });

    it("up arrow on first line moves to start", () => {
      expect(
        processTextEdit("", key({ upArrow: true }), "hello", 3, multi),
      ).toEqual({ value: "hello", cursor: 0 });
    });

    it("up arrow returns null at position 0 for boundary callback", () => {
      expect(
        processTextEdit("", key({ upArrow: true }), "hello", 0, multi),
      ).toBeNull();
    });

    it("up arrow clamps to shorter previous line", () => {
      expect(
        processTextEdit("", key({ upArrow: true }), "ab\ndefgh", 8, multi),
      ).toEqual({ value: "ab\ndefgh", cursor: 2 });
    });

    it("down arrow moves to same column on next line", () => {
      expect(
        processTextEdit("", key({ downArrow: true }), "abc\ndef", 2, multi),
      ).toEqual({ value: "abc\ndef", cursor: 6 });
    });

    it("down arrow on last line moves to end", () => {
      expect(
        processTextEdit("", key({ downArrow: true }), "hello", 3, multi),
      ).toEqual({ value: "hello", cursor: 5 });
    });

    it("down arrow returns null at end for boundary callback", () => {
      expect(
        processTextEdit("", key({ downArrow: true }), "hello", 5, multi),
      ).toBeNull();
    });

    it("down arrow clamps to shorter next line", () => {
      expect(
        processTextEdit("", key({ downArrow: true }), "abcde\nfg", 3, multi),
      ).toEqual({ value: "abcde\nfg", cursor: 8 });
    });

    it("up/down return null in single mode", () => {
      expect(
        processTextEdit("", key({ upArrow: true }), "abc\ndef", 7),
      ).toBeNull();
      expect(
        processTextEdit("", key({ downArrow: true }), "abc\ndef", 0),
      ).toBeNull();
    });

    it("up/down return null when captureUpDown is true", () => {
      const opts = { lineMode: "multi" as const, captureUpDown: true };
      expect(
        processTextEdit("", key({ upArrow: true }), "abc\ndef", 7, opts),
      ).toBeNull();
      expect(
        processTextEdit("", key({ downArrow: true }), "abc\ndef", 0, opts),
      ).toBeNull();
    });
  });

  describe("ignored keys", () => {
    it("returns null for ctrl", () => {
      expect(processTextEdit("c", key({ ctrl: true }), "hello", 0)).toBeNull();
    });

    it("returns null for tab", () => {
      expect(processTextEdit("", key({ tab: true }), "hello", 0)).toBeNull();
    });

    it("returns null for return", () => {
      expect(processTextEdit("", key({ return: true }), "hello", 0)).toBeNull();
    });

    it("returns null for escape", () => {
      expect(processTextEdit("", key({ escape: true }), "hello", 0)).toBeNull();
    });

    it("returns null for up arrow", () => {
      expect(
        processTextEdit("", key({ upArrow: true }), "hello", 0),
      ).toBeNull();
    });

    it("returns null for down arrow", () => {
      expect(
        processTextEdit("", key({ downArrow: true }), "hello", 0),
      ).toBeNull();
    });
  });
});
