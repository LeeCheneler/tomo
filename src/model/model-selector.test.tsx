import { afterEach, describe, expect, it, vi } from "vitest";
import { mockConfig } from "../test-utils/mock-config";
import { renderInk } from "../test-utils/ink";
import { keys } from "../test-utils/keys";
import type { MockFsState } from "../test-utils/mock-fs";
import { ModelSelector } from "./model-selector";

const COLUMNS = 80;

/** Override process.stdout.columns for test predictability. */
function setColumns(width: number | undefined) {
  Object.defineProperty(process.stdout, "columns", {
    value: width,
    writable: true,
    configurable: true,
  });
}

describe("ModelSelector", () => {
  let fsState: MockFsState;

  afterEach(() => {
    fsState?.restore();
    setColumns(undefined);
  });

  /** Renders ModelSelector with mocked config. */
  function renderModelSelector() {
    setColumns(COLUMNS);
    fsState = mockConfig({ global: {} });
    const onDone = vi.fn();
    const result = renderInk(<ModelSelector onDone={onDone} />);
    return { ...result, onDone };
  }

  describe("rendering", () => {
    it("renders heading and borders", () => {
      const { lastFrame } = renderModelSelector();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("─".repeat(COLUMNS));
      expect(frame).toContain("Select Model");
    });
  });

  describe("navigation", () => {
    it("closes on escape", async () => {
      const { stdin, onDone } = renderModelSelector();
      await stdin.write(keys.escape);
      expect(onDone).toHaveBeenCalledOnce();
    });

    it("ignores other keys", async () => {
      const { stdin, onDone } = renderModelSelector();
      await stdin.write("x");
      await stdin.write(keys.enter);
      expect(onDone).not.toHaveBeenCalled();
    });
  });
});
