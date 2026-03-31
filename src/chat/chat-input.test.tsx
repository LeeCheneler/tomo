import { render } from "ink-testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatInput } from "./chat-input";

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

  /** Renders ChatInput with sensible defaults and a fixed terminal width. */
  function renderInput(
    overrides: Partial<{
      onMessage: (message: string) => void;
    }> = {},
  ) {
    setColumns(COLUMNS);

    return render(<ChatInput onMessage={overrides.onMessage ?? (() => {})} />);
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

      const { lastFrame } = render(<ChatInput onMessage={() => {}} />);

      const frame = lastFrame() ?? "";
      const lines = frame.split("\n");
      expect(lines[1]).toBe("─".repeat(80));
    });
  });

  describe("submit", () => {
    it("calls onMessage with value on enter", () => {
      const onMessage = vi.fn();
      const { stdin } = renderInput({ onMessage });
      stdin.write("hello");
      stdin.write("\r");
      expect(onMessage).toHaveBeenCalledWith("hello");
    });

    it("does not call onMessage when value is empty", () => {
      const onMessage = vi.fn();
      const { stdin } = renderInput({ onMessage });
      stdin.write("\r");
      expect(onMessage).not.toHaveBeenCalled();
    });

    it("does not call onMessage when value is only whitespace", () => {
      const onMessage = vi.fn();
      const { stdin } = renderInput({ onMessage });
      stdin.write("   ");
      stdin.write("\r");
      expect(onMessage).not.toHaveBeenCalled();
    });

    it("clears input after submit so next submit requires new input", () => {
      const onMessage = vi.fn();
      const { stdin } = renderInput({ onMessage });
      stdin.write("hello");
      stdin.write("\r");
      stdin.write("\r");
      expect(onMessage).toHaveBeenCalledTimes(1);
    });
  });
});
