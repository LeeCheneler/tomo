import { Box, Text } from "ink";
import { useMemo } from "react";

/** Maximum number of items visible in the autocomplete list. */
export const MAX_VISIBLE = 5;

/** A single autocomplete suggestion. */
export interface AutocompleteItem {
  name: string;
  description: string;
}

/** Props for AutocompleteList. */
interface AutocompleteListProps {
  items: readonly AutocompleteItem[];
  filter: string;
  /** Absolute index in the full filtered list. -1 for no highlight. */
  selectedIndex?: number;
  /** Start index of the visible window. Defaults to 0. */
  windowStart?: number;
}

/** Filters and sorts items. Does not slice — callers handle windowing. */
export function filterAutocompleteItems(
  items: readonly AutocompleteItem[],
  filter: string,
): readonly AutocompleteItem[] {
  const query = filter.toLowerCase();
  return items
    .filter((item) => item.name.toLowerCase().includes(query))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Computes the visible window start for a given selection index. Slides lazily — only moves when the selection hits the window edge. */
export function getWindowStart(
  selectedIndex: number,
  totalCount: number,
  previousStart: number,
): number {
  if (totalCount <= MAX_VISIBLE || selectedIndex < 0) return 0;
  let start = previousStart;
  // Selection moved above the window — scroll up.
  if (selectedIndex < start) {
    start = selectedIndex;
  }
  // Selection moved below the window — scroll down.
  if (selectedIndex >= start + MAX_VISIBLE) {
    start = selectedIndex - MAX_VISIBLE + 1;
  }
  return Math.min(start, Math.max(0, totalCount - MAX_VISIBLE));
}

/** Filtered command list shown below the input. Shows a sliding window of MAX_VISIBLE items. */
export function AutocompleteList(props: AutocompleteListProps) {
  const filtered = useMemo(
    () => filterAutocompleteItems(props.items, props.filter),
    [props.items, props.filter],
  );

  if (filtered.length === 0) {
    return null;
  }

  const selected = props.selectedIndex ?? -1;
  const windowStart = props.windowStart ?? 0;
  const visible = filtered.slice(windowStart, windowStart + MAX_VISIBLE);
  const nameWidth = Math.max(...visible.map((item) => item.name.length + 1));

  return (
    <Box flexDirection="column">
      {visible.map((item, i) => {
        const absoluteIndex = windowStart + i;
        const isSelected = absoluteIndex === selected;
        return (
          <Box key={item.name} gap={2}>
            <Text color={isSelected ? "cyan" : "white"} bold={isSelected}>
              {`/${item.name}`.padEnd(nameWidth)}
            </Text>
            <Text dimColor>{item.description}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
