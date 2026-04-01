import { useRef } from "react";

/** Return value of useHistory. */
export interface HistoryResult {
  /** Read-only list of history entries in chronological order. */
  readonly entries: readonly string[];
  /** Appends an entry to the history. */
  push: (entry: string) => void;
}

/** Manages an append-only list of history entries via a ref. Does not trigger re-renders — the consuming component re-renders from its own state changes. */
export function useHistory(): HistoryResult {
  const ref = useRef(new HistoryApi());
  return ref.current;
}

/** Append-only history list. Getter on entries ensures callers always see the latest array. */
class HistoryApi implements HistoryResult {
  /** Internal mutable array. */
  private _entries: string[] = [];

  /** Read-only list of history entries in chronological order. */
  get entries(): readonly string[] {
    return this._entries;
  }

  /** Appends an entry to the history. */
  push(entry: string) {
    this._entries = [...this._entries, entry];
  }
}
