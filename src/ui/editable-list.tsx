import { Text, useInput } from "ink";
import { useRef, useState } from "react";
import { splitAtCursor } from "../input/cursor";
import { processTextEdit } from "../input/text-edit";
import { Indent } from "./layout/indent";
import { theme } from "./theme";

/** Props for EditableList. */
export interface EditableListProps {
  /** The current saved string values. */
  items: string[];
  /** Called when a new item is added via the add row. */
  onAdd: (value: string) => void;
  /** Called when an existing item is removed (enter on empty). */
  onRemove: (index: number) => void;
  /** Called when an existing item is edited and saved with enter. */
  onUpdate: (index: number, value: string) => void;
  /** Called when escape is pressed. */
  onExit: () => void;
  /** Color for the cursor indicator. Defaults to theme.brand. */
  color?: string;
  /** Placeholder text for the add row. Defaults to "Add item...". */
  placeholder?: string;
}

/**
 * Row layout: [...items, add-row].
 * Total rows = items.length + 1. Last row is always the add row.
 * Cursor starts on the add row.
 */

/** Manages editable list state, navigation, inline editing, and add/remove. */
function useEditableList(props: EditableListProps) {
  const totalRows = props.items.length + 1;
  const addRowIndex = props.items.length;
  const [cursor, setCursor] = useState(addRowIndex);
  const [draft, setDraft] = useState("");
  const [textCursor, setTextCursor] = useState(0);

  // Refs mirror state for immediate access in useInput callbacks.
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const textCursorRef = useRef(textCursor);
  textCursorRef.current = textCursor;
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;

  const isAddRow = cursor === addRowIndex;
  const savedValue = isAddRow ? "" : props.items[cursor];
  const isDraftEmpty = draft.trim() === "";
  const hasUnsavedChanges = !isAddRow && !isDraftEmpty && draft !== savedValue;
  const showRemoveHint = !isAddRow && isDraftEmpty;

  /** Sets draft and text cursor for a given row index. */
  function focusRow(index: number) {
    const value = index === props.items.length ? "" : props.items[index];
    draftRef.current = value;
    setDraft(value);
    const end = value.length;
    textCursorRef.current = end;
    setTextCursor(end);
  }

  /** Updates draft in both ref and state. */
  function updateDraft(value: string) {
    draftRef.current = value;
    setDraft(value);
  }

  /** Updates text cursor in both ref and state. */
  function moveTextCursor(pos: number) {
    textCursorRef.current = pos;
    setTextCursor(pos);
  }

  useInput((input, key) => {
    if (key.escape) {
      props.onExit();
      return;
    }

    if (key.upArrow) {
      setCursor((i) => {
        const next = (i - 1 + totalRows) % totalRows;
        focusRow(next);
        return next;
      });
      return;
    }

    if (key.downArrow) {
      setCursor((i) => {
        const next = (i + 1) % totalRows;
        focusRow(next);
        return next;
      });
      return;
    }

    if (key.return) {
      const currentCursor = cursorRef.current;
      const currentDraft = draftRef.current;
      const onAdd = currentCursor === props.items.length;

      if (onAdd) {
        const trimmed = currentDraft.trim();
        if (trimmed && !props.items.includes(trimmed)) {
          props.onAdd(trimmed);
          // Bump cursor to follow the add row which shifts down by 1.
          const next = currentCursor + 1;
          setCursor(next);
          cursorRef.current = next;
        }
        updateDraft("");
        moveTextCursor(0);
        return;
      }

      // Enter on empty existing item removes it.
      if (currentDraft.trim() === "") {
        props.onRemove(currentCursor);
        // After removal, the next item slides into this position.
        // If we removed the last item, cursor now points to the add row.
        const nextIsAdd = currentCursor >= props.items.length - 1;
        const nextValue = nextIsAdd ? "" : props.items[currentCursor + 1];
        updateDraft(nextValue);
        moveTextCursor(nextValue.length);
        return;
      }

      // Enter on changed existing item saves it.
      if (currentDraft !== props.items[currentCursor]) {
        const trimmed = currentDraft.trim();
        if (trimmed && !props.items.includes(trimmed)) {
          props.onUpdate(currentCursor, trimmed);
        }
      }
      return;
    }

    // Delegate text editing (insert, delete, cursor, word ops).
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

  return {
    cursor,
    draft,
    textCursor,
    isAddRow,
    hasUnsavedChanges,
    showRemoveHint,
  };
}

/** Inline hint indicating enter will save changes. */
function SaveHint() {
  return (
    <Text dimColor>
      {" "}
      <Text color={theme.key}>enter</Text> save
    </Text>
  );
}

/** Inline hint indicating enter will remove the item. */
function RemoveHint() {
  return (
    <Text dimColor>
      {" "}
      <Text color={theme.key}>enter</Text> remove
    </Text>
  );
}

/** Props for AddRow. */
interface AddRowProps {
  isSelected: boolean;
  draft: string;
  textCursor: number;
  color: string;
  placeholder: string;
}

/** The add row at the bottom of the list, with placeholder and inline text editing. */
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

/** Keyboard-navigable list of editable text items with an add row at the bottom. */
export function EditableList(props: EditableListProps) {
  const {
    cursor,
    draft,
    textCursor,
    isAddRow,
    hasUnsavedChanges,
    showRemoveHint,
  } = useEditableList(props);
  const color = props.color ?? theme.brand;
  const placeholder = props.placeholder ?? "Add item...";

  return (
    <>
      {props.items.map((item, i) => {
        const isSelected = i === cursor;

        if (isSelected) {
          const { before, at, after } = splitAtCursor(draft, textCursor);
          return (
            <Indent key={item}>
              <Text color={color}>{"❯ "}</Text>
              <Text>
                {before}
                <Text inverse>{at}</Text>
                {after}
              </Text>
              {hasUnsavedChanges && <SaveHint />}
              {showRemoveHint && <RemoveHint />}
            </Indent>
          );
        }

        return (
          <Indent key={item}>
            <Text>
              {"  "}
              {item}
            </Text>
          </Indent>
        );
      })}
      <AddRow
        isSelected={isAddRow}
        draft={isAddRow ? draft : ""}
        textCursor={textCursor}
        color={color}
        placeholder={placeholder}
      />
    </>
  );
}
