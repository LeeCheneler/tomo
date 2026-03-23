import { useRef, useState } from "react";

export interface AutocompleteItem {
  name: string;
  description: string;
}

export interface AutocompleteEntry extends AutocompleteItem {
  matched: boolean;
}

export interface AutocompleteProvider {
  prefix: string;
  items: () => AutocompleteItem[];
}

export interface AutocompleteState {
  /** Whether autocomplete mode is active. */
  active: boolean;
  /** The matched prefix ("/" or "//"). */
  prefix: string;
  /** Entries visible in the current scroll window. */
  visibleEntries: AutocompleteEntry[];
  /** Index of the selected entry within visibleEntries. */
  visibleSelectedIndex: number;
  /** Ghost text to append after the input. */
  ghost: string;
  /** Whether the ghost text should be displayed. */
  showGhost: boolean;
  /** The full string to submit (prefix + selected name), or null if no match. */
  submitValue: string | null;
  /** Move the selection up (wraps around). */
  moveUp: () => void;
  /** Move the selection down (wraps around). */
  moveDown: () => void;
}

const MAX_VISIBLE = 5;

/**
 * Reusable autocomplete hook. Accepts multiple providers (each with a prefix
 * and items function) and returns match state with up/down keyboard navigation.
 *
 * Matches are sorted to the top, non-matches below. A scrolling window of
 * MAX_VISIBLE entries follows the selection. Providers are checked
 * longest-prefix-first so "//" is matched before "/".
 */
export function useAutocomplete(
  providers: AutocompleteProvider[],
  value: string,
  cursor: number,
): AutocompleteState {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const prevValueRef = useRef(value);
  const windowStartRef = useRef(0);

  // Reset selection and scroll when input changes.
  if (prevValueRef.current !== value) {
    prevValueRef.current = value;
    setSelectedIndex(0);
    windowStartRef.current = 0;
  }

  // Match the provider whose prefix fits (longest first).
  const sorted = [...providers].sort(
    (a, b) => b.prefix.length - a.prefix.length,
  );

  let activeProvider: AutocompleteProvider | null = null;
  for (const provider of sorted) {
    if (value.startsWith(provider.prefix) && !value.includes(" ")) {
      activeProvider = provider;
      break;
    }
  }

  const active = activeProvider !== null;
  const prefix = activeProvider?.prefix ?? "";
  const partial = active ? value.slice(prefix.length) : "";
  const allItems = active ? (activeProvider?.items() ?? []) : [];

  // Matches first, then non-matches. Only show non-matches when there are matches.
  const matched = allItems.filter((item) => item.name.startsWith(partial));
  const unmatched =
    matched.length > 0
      ? allItems.filter((item) => !item.name.startsWith(partial))
      : [];
  const entries: AutocompleteEntry[] = [
    ...matched.map((item) => ({ ...item, matched: true })),
    ...unmatched.map((item) => ({ ...item, matched: false })),
  ];

  // Clamp index so it never exceeds the entry list.
  const clamped =
    entries.length > 0 ? Math.min(selectedIndex, entries.length - 1) : 0;
  const selectedEntry = entries[clamped];

  // Scroll window to keep selection visible.
  if (clamped < windowStartRef.current) {
    windowStartRef.current = clamped;
  } else if (clamped >= windowStartRef.current + MAX_VISIBLE) {
    windowStartRef.current = clamped - MAX_VISIBLE + 1;
  }
  windowStartRef.current = Math.min(
    windowStartRef.current,
    Math.max(0, entries.length - MAX_VISIBLE),
  );

  const visibleStart = windowStartRef.current;
  const visibleEntries = entries.slice(
    visibleStart,
    visibleStart + MAX_VISIBLE,
  );
  const visibleSelectedIndex = clamped - visibleStart;

  // Ghost text only for matched entries.
  const ghost =
    selectedEntry?.matched && partial.length > 0
      ? selectedEntry.name.slice(partial.length)
      : selectedEntry?.matched
        ? selectedEntry.name
        : "";
  const showGhost = active && !!ghost && cursor === value.length;
  const submitValue = selectedEntry ? `${prefix}${selectedEntry.name}` : null;

  const moveUp = () => {
    setSelectedIndex((i) => (i > 0 ? i - 1 : entries.length - 1));
  };

  const moveDown = () => {
    setSelectedIndex((i) => (i < entries.length - 1 ? i + 1 : 0));
  };

  return {
    active,
    prefix,
    visibleEntries,
    visibleSelectedIndex,
    ghost,
    showGhost,
    submitValue,
    moveUp,
    moveDown,
  };
}
