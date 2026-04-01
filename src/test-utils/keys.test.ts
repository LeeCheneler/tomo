import { describe, expect, it } from "vitest";
import { keys } from "./keys";

describe("keys", () => {
  it("defines all expected key constants", () => {
    expect(keys.backspace).toBe("\x08");
    expect(keys.delete).toBe("\x7f");
    expect(keys.enter).toBe("\r");
    expect(keys.shiftEnter).toBe("\x1b[13;2u");
    expect(keys.escape).toBe("\x1b");
    expect(keys.tab).toBe("\t");
    expect(keys.left).toBe("\x1b[D");
    expect(keys.right).toBe("\x1b[C");
    expect(keys.up).toBe("\x1b[A");
    expect(keys.down).toBe("\x1b[B");
    expect(keys.optionLeft).toBe("\x1b[1;3D");
    expect(keys.optionRight).toBe("\x1b[1;3C");
    expect(keys.readlineWordLeft).toBe("\x1bb");
    expect(keys.readlineWordRight).toBe("\x1bf");
    expect(keys.ctrlA).toBe("\x01");
  });
});
