import { Text, useInput } from "ink";
import { useState } from "react";
import { Indent } from "./layout/indent";
import { theme } from "./theme";

/** A single item in a select list. */
export interface SelectListItem {
  key: string;
  label: string;
}

/** Props for SelectList. */
export interface SelectListProps {
  /** Items to display in the list. */
  items: readonly SelectListItem[];
  /** Called when the user selects an item with Enter. */
  onSelect: (item: SelectListItem) => void;
  /** Called when the user presses Escape. */
  onExit: () => void;
  /** Color for the selected item. Defaults to theme.brand. */
  color?: string;
  /**
   * Maximum number of items visible at once. When `items.length` exceeds this,
   * the list scrolls to keep the cursor in view and shows overflow indicators
   * above and below. When omitted, all items render.
   */
  maxVisible?: number;
}

/**
 * Returns the next scrollTop for a given cursor position and window size.
 * Keeps the cursor within the visible window by moving the top edge to
 * follow it when the cursor leaves either side.
 */
function clampScrollTop(
  nextCursor: number,
  currentScrollTop: number,
  maxVisible: number,
): number {
  if (nextCursor < currentScrollTop) return nextCursor;
  if (nextCursor >= currentScrollTop + maxVisible) {
    return nextCursor - maxVisible + 1;
  }
  return currentScrollTop;
}

/** Manages cursor position, scroll window, and keyboard input for a select list. */
function useSelectList(props: SelectListProps) {
  const [cursor, setCursor] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  /** Updates cursor and the scroll window in lockstep. */
  function moveCursor(nextCursor: number) {
    setCursor(nextCursor);
    const maxVisible = props.maxVisible;
    if (maxVisible === undefined) return;
    setScrollTop((prev) => clampScrollTop(nextCursor, prev, maxVisible));
  }

  useInput((_input, key) => {
    if (key.escape) {
      props.onExit();
      return;
    }

    if (key.upArrow) {
      const count = props.items.length;
      moveCursor((cursor - 1 + count) % count);
      return;
    }

    if (key.downArrow) {
      moveCursor((cursor + 1) % props.items.length);
      return;
    }

    if (key.return) {
      props.onSelect(props.items[cursor]);
      return;
    }
  });

  return { cursor, scrollTop };
}

/** Keyboard-navigable list with cursor indicator and optional scroll window. */
export function SelectList(props: SelectListProps) {
  const { cursor, scrollTop } = useSelectList(props);
  const color = props.color ?? theme.brand;

  const maxVisible = props.maxVisible;
  const totalItems = props.items.length;
  const windowed = maxVisible !== undefined && totalItems > maxVisible;
  const startIndex = windowed ? scrollTop : 0;
  const endIndex = windowed ? scrollTop + maxVisible : totalItems;
  const visibleItems = windowed
    ? props.items.slice(startIndex, endIndex)
    : props.items;
  const hiddenAbove = windowed ? startIndex : 0;
  const hiddenBelow = windowed ? totalItems - endIndex : 0;

  return (
    <>
      {hiddenAbove > 0 && (
        <Indent>
          <Text dimColor>↑ {hiddenAbove} more</Text>
        </Indent>
      )}
      {visibleItems.map((item, i) => {
        const actualIndex = startIndex + i;
        const isSelected = actualIndex === cursor;
        return (
          <Indent key={item.key}>
            <Text color={isSelected ? color : undefined}>
              {isSelected ? "❯" : " "} {item.label}
            </Text>
          </Indent>
        );
      })}
      {hiddenBelow > 0 && (
        <Indent>
          <Text dimColor>↓ {hiddenBelow} more</Text>
        </Indent>
      )}
    </>
  );
}
