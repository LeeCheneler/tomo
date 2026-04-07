import { useCallback, useState } from "react";
import type { ImageAttachment } from "../images/clipboard";

/** A single history entry with text and optional images. */
export interface HistoryEntry {
  text: string;
  images: ImageAttachment[];
}

/** Return value of useHistory. */
export interface HistoryResult {
  /** Read-only list of history entries in chronological order. */
  readonly entries: readonly HistoryEntry[];
  /** Appends an entry to the history. */
  push: (entry: HistoryEntry) => void;
}

/** Manages an append-only list of history entries. Triggers re-renders on push. */
export function useHistory(): HistoryResult {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);

  /** Appends an entry to the history. */
  const push = useCallback((entry: HistoryEntry) => {
    setEntries((prev) => [...prev, entry]);
  }, []);

  return { entries, push };
}
