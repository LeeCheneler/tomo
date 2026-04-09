import { Text, useInput } from "ink";
import { useRef, useState } from "react";
import { splitAtCursor } from "../input/cursor";
import { processTextEdit } from "../input/text-edit";
import { Indent } from "./layout/indent";
import { theme } from "./theme";

/** Props for KvEditor. */
export interface KvEditorProps {
  /** Initial key-value entries to populate the editor. */
  entries: Record<string, string>;
  /** Called with the cleaned final entries when the user exits via tab or escape. */
  onExit: (entries: Record<string, string>) => void;
  /** Color for the cursor indicator. Defaults to theme.brand. */
  color?: string;
  /** Placeholder text for the add row. Defaults to "Add entry...". */
  placeholder?: string;
}

/** Converts a record to an array of "KEY=VALUE" rows. */
function entriesToRows(entries: Record<string, string>): string[] {
  return Object.entries(entries).map(([k, v]) => `${k}=${v}`);
}

/** Parses a raw row into key/value, or null if it cannot be parsed. */
function parseRow(row: string): { key: string; value: string } | null {
  const trimmed = row.trim();
  if (!trimmed) return null;
  const idx = trimmed.indexOf("=");
  if (idx <= 0) return null;
  const key = trimmed.slice(0, idx).trim();
  if (!key) return null;
  const value = trimmed.slice(idx + 1);
  return { key, value };
}

/** Builds the final record from the row array, applying last-write-wins on duplicate keys. */
function buildRecord(rows: readonly string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const row of rows) {
    const parsed = parseRow(row);
    if (parsed) {
      result[parsed.key] = parsed.value;
    }
  }
  return result;
}

/** Per-row save status: ok, invalid (won't parse), duplicate (overridden by a later row). */
export type RowStatus = "ok" | "empty" | "invalid" | "duplicate";

/** Determines per-row status given the live row contents. */
function computeStatuses(rows: readonly string[]): RowStatus[] {
  const statuses: RowStatus[] = rows.map(() => "ok");
  const validIndices: { idx: number; key: string }[] = [];
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].trim() === "") {
      statuses[i] = "empty";
      continue;
    }
    const parsed = parseRow(rows[i]);
    if (!parsed) {
      statuses[i] = "invalid";
    } else {
      validIndices.push({ idx: i, key: parsed.key });
    }
  }
  // Walk in reverse so the last occurrence of each key wins.
  const seen = new Set<string>();
  for (let i = validIndices.length - 1; i >= 0; i--) {
    const { idx, key } = validIndices[i];
    if (seen.has(key)) {
      statuses[idx] = "duplicate";
    } else {
      seen.add(key);
    }
  }
  return statuses;
}

/** Manages kv editor state, navigation, inline row editing, and add/remove. */
function useKvEditor(props: KvEditorProps) {
  const [rows, setRows] = useState<string[]>(() =>
    entriesToRows(props.entries),
  );
  const [cursor, setCursor] = useState<number>(() => rows.length);
  const [draft, setDraft] = useState("");
  const [textCursor, setTextCursor] = useState(0);

  // Refs mirror state for immediate access in useInput callbacks,
  // avoiding stale closures during rapid sequential keypresses.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const textCursorRef = useRef(textCursor);
  textCursorRef.current = textCursor;

  /** Updates rows in both ref and state. */
  function updateRows(next: string[]) {
    rowsRef.current = next;
    setRows(next);
  }

  /** Updates draft in both ref and state. */
  function updateDraft(value: string) {
    draftRef.current = value;
    setDraft(value);
  }

  /** Updates the text cursor in both ref and state. */
  function moveTextCursor(pos: number) {
    textCursorRef.current = pos;
    setTextCursor(pos);
  }

  /** Loads the row at the given index into the draft buffer. */
  function focusRow(index: number) {
    const value = index >= rowsRef.current.length ? "" : rowsRef.current[index];
    updateDraft(value);
    moveTextCursor(value.length);
  }

  /** Returns rows with any unsaved draft on the current row applied. */
  function rowsWithDraft(): string[] {
    const c = cursorRef.current;
    const next = [...rowsRef.current];
    if (c < next.length) {
      next[c] = draftRef.current;
    } else if (draftRef.current.trim() !== "") {
      next.push(draftRef.current);
    }
    return next;
  }

  /** Exits the editor, emitting the cleaned final record. */
  function exit() {
    props.onExit(buildRecord(rowsWithDraft()));
  }

  useInput((input, key) => {
    if (key.escape || key.tab) {
      exit();
      return;
    }

    if (key.upArrow) {
      // Save draft to its row before moving away.
      const c = cursorRef.current;
      if (c < rowsRef.current.length) {
        const next = [...rowsRef.current];
        next[c] = draftRef.current;
        updateRows(next);
      }
      const total = rowsRef.current.length + 1;
      const nextCursor = (c - 1 + total) % total;
      setCursor(nextCursor);
      cursorRef.current = nextCursor;
      focusRow(nextCursor);
      return;
    }

    if (key.downArrow) {
      const c = cursorRef.current;
      if (c < rowsRef.current.length) {
        const next = [...rowsRef.current];
        next[c] = draftRef.current;
        updateRows(next);
      }
      const total = rowsRef.current.length + 1;
      const nextCursor = (c + 1) % total;
      setCursor(nextCursor);
      cursorRef.current = nextCursor;
      focusRow(nextCursor);
      return;
    }

    if (key.return) {
      const c = cursorRef.current;
      const d = draftRef.current;
      const onAddRow = c === rowsRef.current.length;

      if (onAddRow) {
        if (d.trim() === "") return;
        const next = [...rowsRef.current, d];
        updateRows(next);
        // Cursor stays on the (now-shifted) add row so the user can add another.
        const newAddRow = next.length;
        setCursor(newAddRow);
        cursorRef.current = newAddRow;
        updateDraft("");
        moveTextCursor(0);
        return;
      }

      // Enter on an existing row with empty draft removes the row.
      if (d.trim() === "") {
        const next = rowsRef.current.filter((_, i) => i !== c);
        updateRows(next);
        // Next item slides up into this position; if we removed the last row,
        // we're now on the add row.
        const nextValue = c >= next.length ? "" : next[c];
        updateDraft(nextValue);
        moveTextCursor(nextValue.length);
        return;
      }

      // Enter on an existing row commits the edit.
      const next = [...rowsRef.current];
      next[c] = d;
      updateRows(next);
      return;
    }

    // Delegate text editing (insert, backspace, cursor, word ops).
    const edit = processTextEdit(
      input,
      key,
      draftRef.current,
      textCursorRef.current,
    );
    if (edit) {
      updateDraft(edit.value);
      moveTextCursor(edit.cursor);
    }
  });

  // Statuses reflect what *would* be saved right now, including the live draft
  // on the current row, so warnings appear as the user types.
  const statuses = computeStatuses(rowsWithDraft());

  return {
    rows,
    cursor,
    draft,
    textCursor,
    statuses,
  };
}

/** Renders an inline warning suffix for a row that won't be saved. */
function StatusSuffix(props: { status: RowStatus }) {
  if (props.status === "invalid") {
    return <Text color={theme.warning}> (invalid: missing =)</Text>;
  }
  if (props.status === "duplicate") {
    return <Text color={theme.warning}> (duplicate, will be dropped)</Text>;
  }
  return null;
}

/** Props for the editable row. */
interface RowProps {
  isSelected: boolean;
  value: string;
  draft: string;
  textCursor: number;
  status: RowStatus;
  color: string;
}

/** A single editable row in the kv list. */
function Row(props: RowProps) {
  if (props.isSelected) {
    const { before, at, after } = splitAtCursor(props.draft, props.textCursor);
    return (
      <Indent>
        <Text color={props.color}>{"❯ "}</Text>
        <Text>
          {before}
          <Text inverse>{at}</Text>
          {after}
        </Text>
        <StatusSuffix status={props.status} />
      </Indent>
    );
  }

  return (
    <Indent>
      <Text>
        {"  "}
        {props.value}
      </Text>
      <StatusSuffix status={props.status} />
    </Indent>
  );
}

/** Props for the trailing add row. */
interface AddRowProps {
  isSelected: boolean;
  draft: string;
  textCursor: number;
  status: RowStatus;
  color: string;
  placeholder: string;
}

/** The add row at the bottom of the list, with placeholder and inline editing. */
function AddRow(props: AddRowProps) {
  if (props.isSelected && props.draft !== "") {
    const { before, at, after } = splitAtCursor(props.draft, props.textCursor);
    return (
      <Indent>
        <Text color={props.color}>{"❯ "}</Text>
        <Text>
          {before}
          <Text inverse>{at}</Text>
          {after}
        </Text>
        <StatusSuffix status={props.status} />
      </Indent>
    );
  }

  if (props.isSelected) {
    return (
      <Indent>
        <Text color={props.color}>{"❯ "}</Text>
        <Text dimColor>
          <Text inverse>{props.placeholder[0]}</Text>
          {props.placeholder.slice(1)}
        </Text>
      </Indent>
    );
  }

  return (
    <Indent>
      <Text dimColor>
        {"  "}
        {props.placeholder}
      </Text>
    </Indent>
  );
}

/**
 * Keyboard-navigable editor for a record of string key-value pairs.
 *
 * Each row is a single text input of the form `KEY=VALUE`. Rows that fail
 * to parse (missing `=` or empty key) are marked invalid and dropped on
 * exit. Duplicate keys resolve last-write-wins; earlier duplicates are
 * marked and dropped on exit. Tab or escape exits and emits the cleaned
 * record via `onExit`.
 */
export function KvEditor(props: KvEditorProps) {
  const { rows, cursor, draft, textCursor, statuses } = useKvEditor(props);
  const color = props.color ?? theme.brand;
  const placeholder = props.placeholder ?? "Add entry...";
  const addRowIndex = rows.length;

  return (
    <>
      {rows.map((row, i) => (
        <Row
          // biome-ignore lint/suspicious/noArrayIndexKey: rows are positional and Row is presentational
          key={i}
          isSelected={i === cursor}
          value={row}
          draft={draft}
          textCursor={textCursor}
          status={statuses[i]}
          color={color}
        />
      ))}
      <AddRow
        isSelected={cursor === addRowIndex}
        draft={cursor === addRowIndex ? draft : ""}
        textCursor={textCursor}
        status={statuses[addRowIndex] ?? "empty"}
        color={color}
        placeholder={placeholder}
      />
    </>
  );
}
