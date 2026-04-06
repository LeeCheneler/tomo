import { Box, Text } from "ink";
import { useMemo, useState } from "react";

/** Maximum number of items visible in the autocomplete list. */
export const MAX_VISIBLE = 5;

/** A single autocomplete suggestion. */
export interface AutocompleteItem {
  /** Unique identifier used as the React key. Falls back to name if not set. */
  key: string;
  /** Display name shown in the autocomplete list. */
  name: string;
  /** Description shown alongside the name. */
  description: string;
  /** Optional tag rendered before the description (e.g. "(local)"). */
  tag?: string;
}

/** Which autocomplete list to show based on input prefix. */
export type AutocompleteMode = "command" | "skill" | "none";

/** Return value of useAutocompleteNavigation. */
export interface AutocompleteNavigation {
  /** Whether autocomplete is active. */
  isActive: boolean;
  /** The filtered items for the current input. */
  filtered: readonly AutocompleteItem[];
  /** Absolute selected index in the filtered list. */
  selectedIndex: number;
  /** Start index of the visible window. */
  windowStart: number;
  /** Move selection up (loops). */
  moveUp: () => void;
  /** Move selection down (loops). */
  moveDown: () => void;
  /** Returns the currently selected item, or undefined if none. */
  select: () => AutocompleteItem | undefined;
  /** Resets selection and window to the start. */
  reset: () => void;
}

/** Filters and sorts items by name. */
export function filterAutocompleteItems(
  items: readonly AutocompleteItem[],
  filter: string,
): readonly AutocompleteItem[] {
  const query = filter.toLowerCase();
  return items
    .filter((item) => item.name.toLowerCase().includes(query))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Computes the visible window start. Slides lazily when the selection hits the edge. */
function computeWindowStart(
  selectedIndex: number,
  totalCount: number,
  previousStart: number,
): number {
  if (totalCount <= MAX_VISIBLE || selectedIndex < 0) return 0;
  let start = previousStart;
  if (selectedIndex < start) {
    start = selectedIndex;
  }
  if (selectedIndex >= start + MAX_VISIBLE) {
    start = selectedIndex - MAX_VISIBLE + 1;
  }
  return Math.min(start, Math.max(0, totalCount - MAX_VISIBLE));
}

/** Manages autocomplete filtering, selection, and windowing. */
export function useAutocompleteNavigation(
  items: readonly AutocompleteItem[],
  filter: string,
  isActive: boolean,
): AutocompleteNavigation {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [windowStart, setWindowStart] = useState(0);

  const filtered = useMemo(
    () => filterAutocompleteItems(items, filter),
    [items, filter],
  );

  /** Moves selection up with looping and window sliding. */
  function moveUp() {
    const count = filtered.length;
    if (count === 0) return;
    setSelectedIndex((i) => {
      const next = (i - 1 + count) % count;
      setWindowStart((ws) => computeWindowStart(next, count, ws));
      return next;
    });
  }

  /** Moves selection down with looping and window sliding. */
  function moveDown() {
    const count = filtered.length;
    if (count === 0) return;
    setSelectedIndex((i) => {
      const next = (i + 1) % count;
      setWindowStart((ws) => computeWindowStart(next, count, ws));
      return next;
    });
  }

  /** Returns the currently selected item. */
  function select(): AutocompleteItem | undefined {
    return filtered[selectedIndex];
  }

  /** Resets selection and window to the start. */
  function reset() {
    setSelectedIndex(0);
    setWindowStart(0);
  }

  return {
    isActive,
    filtered,
    selectedIndex,
    windowStart,
    moveUp,
    moveDown,
    select,
    reset,
  };
}

/** Props for AutocompleteList. */
interface AutocompleteListProps {
  /** The autocomplete navigation state. */
  autocomplete: AutocompleteNavigation;
  /** Prefix to display before each item name ("/" for commands, "//" for skills). */
  prefix: string;
}

/** Filtered autocomplete list shown below the input. Shows a sliding window of MAX_VISIBLE items. */
export function AutocompleteList(props: AutocompleteListProps) {
  const { filtered, selectedIndex, windowStart } = props.autocomplete;

  if (filtered.length === 0) {
    return null;
  }

  const visible = filtered.slice(windowStart, windowStart + MAX_VISIBLE);
  const nameWidth = Math.max(
    ...visible.map((item) => props.prefix.length + item.name.length),
  );

  return (
    <Box flexDirection="column">
      {visible.map((item, i) => {
        const absoluteIndex = windowStart + i;
        const isSelected = absoluteIndex === selectedIndex;
        return (
          <Box key={item.key} gap={2}>
            <Text color={isSelected ? "cyan" : "white"} bold={isSelected}>
              {`${props.prefix}${item.name}`.padEnd(nameWidth)}
            </Text>
            {item.tag && <Text color="magenta">{item.tag}</Text>}
            <Text dimColor>{item.description}</Text>
          </Box>
        );
      })}
    </Box>
  );
}

/** Returns the autocomplete mode based on input value and available items. */
export function getAutocompleteMode(
  value: string,
  commandItems: readonly AutocompleteItem[],
  skillItems: readonly AutocompleteItem[],
): AutocompleteMode {
  if (value.includes(" ")) return "none";
  if (value.startsWith("//") && skillItems.length > 0) return "skill";
  if (
    value.startsWith("/") &&
    !value.startsWith("//") &&
    commandItems.length > 0
  )
    return "command";
  return "none";
}
