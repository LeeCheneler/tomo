import { Text } from "ink";
import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { useListNavigation } from "./use-list-navigation";

const flush = () => new Promise((r) => setTimeout(r, 50));

interface HarnessProps {
  itemCount: number;
  maxVisible?: number;
  wrap?: boolean;
}

let controls: {
  cursor: number;
  windowStart: number;
  handleUp: () => void;
  handleDown: () => void;
  setCursor: (n: number) => void;
};

function Harness({ itemCount, maxVisible, wrap }: HarnessProps) {
  const nav = useListNavigation(itemCount, { maxVisible, wrap });
  controls = {
    ...nav,
    setCursor: (n: number) => nav.setCursor(n),
  };
  return (
    <Text>
      {nav.cursor}/{nav.windowStart}
    </Text>
  );
}

describe("useListNavigation", () => {
  describe("cursor wrapping (default)", () => {
    it("wraps cursor down past last item to first", async () => {
      render(<Harness itemCount={3} />);
      await flush();
      controls.setCursor(2);
      await flush();
      controls.handleDown();
      await flush();
      expect(controls.cursor).toBe(0);
    });

    it("wraps cursor up past first item to last", async () => {
      render(<Harness itemCount={3} />);
      await flush();
      controls.handleUp();
      await flush();
      expect(controls.cursor).toBe(2);
    });

    it("moves cursor down normally", async () => {
      render(<Harness itemCount={3} />);
      await flush();
      controls.handleDown();
      await flush();
      expect(controls.cursor).toBe(1);
    });

    it("moves cursor up normally", async () => {
      render(<Harness itemCount={3} />);
      await flush();
      controls.setCursor(2);
      await flush();
      controls.handleUp();
      await flush();
      expect(controls.cursor).toBe(1);
    });

    it("traverses full list with sequential down presses", async () => {
      render(<Harness itemCount={4} />);
      await flush();
      for (let i = 0; i < 4; i++) {
        expect(controls.cursor).toBe(i);
        controls.handleDown();
        await flush();
      }
      // Should have wrapped back to 0
      expect(controls.cursor).toBe(0);
    });
  });

  describe("non-wrapping mode", () => {
    it("stops at first item going up", async () => {
      render(<Harness itemCount={3} wrap={false} />);
      await flush();
      controls.handleUp();
      await flush();
      expect(controls.cursor).toBe(0);
    });

    it("stops at last item going down", async () => {
      render(<Harness itemCount={3} wrap={false} />);
      await flush();
      controls.setCursor(2);
      await flush();
      controls.handleDown();
      await flush();
      expect(controls.cursor).toBe(2);
    });

    it("moves normally within range", async () => {
      render(<Harness itemCount={5} wrap={false} />);
      await flush();
      controls.handleDown();
      await flush();
      controls.handleDown();
      await flush();
      expect(controls.cursor).toBe(2);
      controls.handleUp();
      await flush();
      expect(controls.cursor).toBe(1);
    });
  });

  describe("sliding window", () => {
    it("keeps windowStart at 0 initially", async () => {
      render(<Harness itemCount={10} maxVisible={3} />);
      await flush();
      expect(controls.windowStart).toBe(0);
    });

    it("slides window down when cursor passes bottom edge", async () => {
      render(<Harness itemCount={10} maxVisible={3} />);
      await flush();
      controls.setCursor(3);
      await flush();
      expect(controls.windowStart).toBe(1);
    });

    it("slides window up when cursor passes top edge", async () => {
      render(<Harness itemCount={10} maxVisible={3} />);
      await flush();
      controls.setCursor(5);
      await flush();
      controls.setCursor(2);
      await flush();
      expect(controls.windowStart).toBe(2);
    });

    it("does not shift window when cursor moves within visible range", async () => {
      render(<Harness itemCount={10} maxVisible={5} />);
      await flush();
      controls.handleDown(); // cursor 1, window [0..4]
      await flush();
      expect(controls.windowStart).toBe(0);
      controls.handleDown(); // cursor 2, still in window
      await flush();
      expect(controls.windowStart).toBe(0);
      controls.handleDown(); // cursor 3, still in window
      await flush();
      expect(controls.windowStart).toBe(0);
    });

    it("clamps window when cursor is near end of list", async () => {
      render(<Harness itemCount={5} maxVisible={3} />);
      await flush();
      controls.setCursor(4); // last item
      await flush();
      // windowStart should be at most 5 - 3 = 2
      expect(controls.windowStart).toBe(2);
    });

    it("window follows cursor wrapping back to top", async () => {
      render(<Harness itemCount={10} maxVisible={3} />);
      await flush();
      controls.setCursor(9); // last item, windowStart = 7
      await flush();
      expect(controls.windowStart).toBe(7);
      controls.handleDown(); // wraps to 0
      await flush();
      expect(controls.cursor).toBe(0);
      expect(controls.windowStart).toBe(0);
    });

    it("does nothing when maxVisible >= itemCount", async () => {
      render(<Harness itemCount={3} maxVisible={5} />);
      await flush();
      controls.setCursor(2);
      await flush();
      // Window should stay at 0 since all items fit
      expect(controls.windowStart).toBe(0);
    });

    it("works with non-wrapping mode", async () => {
      render(<Harness itemCount={10} maxVisible={3} wrap={false} />);
      await flush();
      controls.setCursor(5);
      await flush();
      expect(controls.windowStart).toBe(3);
      // Going down to boundary then trying to go past
      controls.setCursor(9);
      await flush();
      controls.handleDown(); // should stay at 9
      await flush();
      expect(controls.cursor).toBe(9);
      expect(controls.windowStart).toBe(7);
    });
  });

  describe("dynamic item count", () => {
    it("clamps cursor when item count shrinks below cursor", async () => {
      const { rerender } = render(<Harness itemCount={5} />);
      await flush();
      controls.setCursor(4);
      await flush();
      expect(controls.cursor).toBe(4);
      rerender(<Harness itemCount={3} />);
      await flush();
      expect(controls.cursor).toBe(2);
    });

    it("keeps cursor at 0 when item count grows", async () => {
      const { rerender } = render(<Harness itemCount={3} />);
      await flush();
      expect(controls.cursor).toBe(0);
      rerender(<Harness itemCount={10} />);
      await flush();
      expect(controls.cursor).toBe(0);
    });

    it("cursor reset to 0 also resets window", async () => {
      render(<Harness itemCount={10} maxVisible={3} />);
      await flush();
      controls.setCursor(7);
      await flush();
      expect(controls.windowStart).toBe(5);
      controls.setCursor(0);
      await flush();
      expect(controls.windowStart).toBe(0);
    });
  });

  describe("edge cases", () => {
    it("handles zero items", async () => {
      render(<Harness itemCount={0} />);
      await flush();
      controls.handleUp();
      await flush();
      expect(controls.cursor).toBe(0);
      controls.handleDown();
      await flush();
      expect(controls.cursor).toBe(0);
    });

    it("handles single item with wrapping", async () => {
      render(<Harness itemCount={1} />);
      await flush();
      controls.handleDown();
      await flush();
      expect(controls.cursor).toBe(0);
      controls.handleUp();
      await flush();
      expect(controls.cursor).toBe(0);
    });

    it("handles single item without wrapping", async () => {
      render(<Harness itemCount={1} wrap={false} />);
      await flush();
      controls.handleDown();
      await flush();
      expect(controls.cursor).toBe(0);
      controls.handleUp();
      await flush();
      expect(controls.cursor).toBe(0);
    });

    it("handles zero items with sliding window", async () => {
      render(<Harness itemCount={0} maxVisible={3} />);
      await flush();
      expect(controls.windowStart).toBe(0);
      controls.handleDown();
      await flush();
      expect(controls.cursor).toBe(0);
      expect(controls.windowStart).toBe(0);
    });
  });
});
