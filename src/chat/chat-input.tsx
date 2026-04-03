import { Box, Text, useInput } from "ink";
import { useRef, useState } from "react";
import { splitAtCursor } from "../input/cursor";
import { processTextEdit } from "../input/text-edit";
import type { AutocompleteItem } from "./autocomplete";
import { AutocompleteList, useAutocompleteNavigation } from "./autocomplete";
import { Border } from "../ui/border";
import type { InstructionItem } from "../ui/key-instructions";
import { KeyInstructions } from "../ui/key-instructions";
import { theme } from "../ui/theme";

/** Props for the ChatInput component. */
export interface ChatInputProps {
  /** Called when the user submits a message. */
  onMessage: (message: string) => void;
  /** Called when up arrow is pressed at the start of the input. Receives the current draft value. */
  onUp?: (draft: string) => void;
  /** Initial text to populate the input with on mount. */
  initialValue?: string;
  /** Whether message history is available for browsing. */
  hasHistory?: boolean;
  /** Items to show in the autocomplete list when typing a command. */
  autocompleteItems: readonly AutocompleteItem[];
}

/** Returns true when autocomplete should be visible for the given input and items. */
function shouldShowAutocomplete(
  value: string,
  items: readonly AutocompleteItem[],
): boolean {
  if (items.length === 0) return false;
  return (
    value.startsWith("/") && !value.startsWith("//") && !value.includes(" ")
  );
}

/** Manages chat input state, cursor, and keyboard handling. */
function useChatInput(props: ChatInputProps) {
  const initial = props.initialValue ?? "";
  const [value, setValue] = useState(initial);
  const [escPending, setEscPending] = useState(false);
  const [cursor, setCursorState] = useState(initial.length);
  const valueRef = useRef(initial);
  const cursorRef = useRef(initial.length);

  const showAutocomplete = shouldShowAutocomplete(
    value,
    props.autocompleteItems,
  );

  const autocomplete = useAutocompleteNavigation(
    props.autocompleteItems,
    value.startsWith("/") ? value.slice(1) : "",
    showAutocomplete,
  );

  /** Updates value in both state and ref. */
  function applyChange(newValue: string) {
    valueRef.current = newValue;
    setValue(newValue);
    setEscPending(false);
    autocomplete.reset();
  }

  /** Updates cursor in both state and ref. */
  function setCursorPos(pos: number) {
    cursorRef.current = pos;
    setCursorState(pos);
  }

  useInput((input, key) => {
    const pos = cursorRef.current;
    const val = valueRef.current;

    if (key.return) {
      if (showAutocomplete) {
        const selected = autocomplete.select();
        /* v8 ignore next -- selectedIndex is always in bounds */
        if (!selected) return;
        const filled = `/${selected.name} `;
        applyChange(filled);
        setCursorPos(filled.length);
        return;
      }

      if (val.trim() === "") return;
      props.onMessage(val);
      applyChange("");
      setCursorPos(0);
      return;
    }

    if (key.escape) {
      if (escPending) {
        applyChange("");
        setCursorPos(0);
        return;
      }
      if (val.length > 0) {
        setEscPending(true);
      }
      return;
    }

    if (key.upArrow && showAutocomplete) {
      autocomplete.moveUp();
      return;
    }

    if (key.downArrow && showAutocomplete) {
      autocomplete.moveDown();
      return;
    }

    // Delegate text editing (insert, delete, cursor, word ops, multi-line nav).
    const edit = processTextEdit(input, key, val, pos, { lineMode: "multi" });
    if (edit) {
      if (edit.value !== val) {
        applyChange(edit.value);
      }
      setCursorPos(edit.cursor);
      return;
    }

    // processTextEdit returns null for up/down at boundaries in multi mode.
    if (key.upArrow) {
      props.onUp?.(val);
    }
  });

  // Clamp cursor to valid range on each render.
  const clampedCursor = Math.max(0, Math.min(cursor, value.length));

  const instructions: InstructionItem[] = showAutocomplete
    ? [
        { key: "enter", description: "select" },
        { key: "up/down", description: "navigate" },
      ]
    : [
        { key: "/", description: "command" },
        { key: "enter", description: "submit" },
        { key: "up", description: "history" },
      ];

  instructions.push({ key: "esc", description: "clear" });

  return {
    value,
    cursor: clampedCursor,
    escPending,
    instructions,
    showAutocomplete,
    autocomplete,
  };
}

/** Chat input with bordered text area and inline autocomplete. */
export function ChatInput(props: ChatInputProps) {
  const {
    value,
    cursor,
    escPending,
    instructions,
    showAutocomplete,
    autocomplete,
  } = useChatInput(props);
  const { before, at, after } = splitAtCursor(value, cursor);

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Border color={theme.brand} />
      <Box>
        <Text color={theme.brand}>{"❯ "}</Text>
        {escPending ? (
          <Text color={theme.warning} inverse>
            {before}
            {at}
            {after}
          </Text>
        ) : (
          <Text>
            {before}
            <Text inverse>{at}</Text>
            {after}
          </Text>
        )}
      </Box>
      <Border color={theme.brand} />
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions items={instructions} />
      </Box>
      {showAutocomplete && <AutocompleteList autocomplete={autocomplete} />}
    </Box>
  );
}
