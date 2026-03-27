import { useCallback, useEffect, useRef, useState } from "react";

interface UseListNavigationOptions {
  maxVisible?: number;
  wrap?: boolean;
}

/**
 * Shared hook for cursor navigation and sliding window in list selectors.
 *
 * @param itemCount - Number of items in the list (may change dynamically)
 * @param options.maxVisible - If set, computes a sliding windowStart for virtualised rendering
 * @param options.wrap - Whether cursor wraps around at boundaries (default true)
 */
export function useListNavigation(
  itemCount: number,
  options?: UseListNavigationOptions,
) {
  const { maxVisible, wrap = true } = options ?? {};
  const [cursor, setCursor] = useState(0);
  const windowStartRef = useRef(0);

  // Clamp cursor when item count shrinks
  useEffect(() => {
    if (itemCount > 0 && cursor >= itemCount) {
      setCursor(itemCount - 1);
    }
  }, [itemCount, cursor]);

  const handleUp = useCallback(() => {
    setCursor((c) => {
      if (itemCount === 0) return 0;
      return wrap ? (c > 0 ? c - 1 : itemCount - 1) : Math.max(0, c - 1);
    });
  }, [itemCount, wrap]);

  const handleDown = useCallback(() => {
    setCursor((c) => {
      if (itemCount === 0) return 0;
      return wrap
        ? c < itemCount - 1
          ? c + 1
          : 0
        : Math.min(itemCount - 1, c + 1);
    });
  }, [itemCount, wrap]);

  // Sliding window calculation
  let windowStart = windowStartRef.current;
  if (maxVisible && itemCount > 0) {
    if (cursor < windowStart) {
      windowStart = cursor;
    } else if (cursor >= windowStart + maxVisible) {
      windowStart = cursor - maxVisible + 1;
    }
    windowStart = Math.min(windowStart, Math.max(0, itemCount - maxVisible));
    windowStartRef.current = windowStart;
  }

  return { cursor, setCursor, windowStart, handleUp, handleDown };
}
