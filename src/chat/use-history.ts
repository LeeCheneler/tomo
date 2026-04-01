import { useCallback, useState } from "react";

/** Return value of useHistory. */
export interface HistoryResult {
  /** Read-only list of history entries in chronological order. */
  readonly entries: readonly string[];
  /** Appends an entry to the history. */
  push: (entry: string) => void;
}

/** Manages an append-only list of history entries. Triggers re-renders on push. */
export function useHistory(): HistoryResult {
  const [entries, setEntries] = useState<string[]>([]);

  /** Appends an entry to the history. */
  const push = useCallback((entry: string) => {
    setEntries((prev) => [...prev, entry]);
  }, []);

  return { entries, push };
}
