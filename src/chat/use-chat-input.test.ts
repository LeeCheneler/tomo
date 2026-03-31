import { render } from "ink-testing-library";
import { createElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { useChatInput } from "./use-chat-input";

/** Test harness that renders useChatInput. */
function Harness(props: { onMessage: (message: string) => void }) {
  useChatInput({ onMessage: props.onMessage });
  return null;
}

/** Renders the harness with sensible defaults. */
function renderHarness(
  overrides: Partial<{
    onMessage: (message: string) => void;
  }> = {},
) {
  return render(
    createElement(Harness, {
      onMessage: overrides.onMessage ?? (() => {}),
    }),
  );
}

describe("useChatInput", () => {
  describe("submit", () => {
    it("calls onMessage with value and clears input on enter", () => {
      const onMessage = vi.fn();
      const { stdin } = renderHarness({ onMessage });
      stdin.write("hello");
      stdin.write("\r");
      expect(onMessage).toHaveBeenCalledWith("hello");
    });

    it("does not call onMessage when value is empty", () => {
      const onMessage = vi.fn();
      const { stdin } = renderHarness({ onMessage });
      stdin.write("\r");
      expect(onMessage).not.toHaveBeenCalled();
    });

    it("does not call onMessage when value is only whitespace", () => {
      const onMessage = vi.fn();
      const { stdin } = renderHarness({ onMessage });
      stdin.write("   ");
      stdin.write("\r");
      expect(onMessage).not.toHaveBeenCalled();
    });

    it("clears input after submit so next submit requires new input", () => {
      const onMessage = vi.fn();
      const { stdin } = renderHarness({ onMessage });
      stdin.write("hello");
      stdin.write("\r");
      // Second submit without typing should be a no-op.
      stdin.write("\r");
      expect(onMessage).toHaveBeenCalledTimes(1);
    });
  });
});
