import { Box, Text } from "ink";
import { useRef, useState } from "react";
import { useTextInput } from "../input/text";
import type { AutocompleteItem } from "./autocomplete";
import { AutocompleteList, useAutocompleteNavigation } from "./autocomplete";
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

/** Returns the terminal width, defaulting to 80 if unavailable. */
function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}

/** Builds a full-width border line of ─ characters. */
function buildBorder(): string {
  return "─".repeat(getTerminalWidth());
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

/** Manages chat input state and submission. Delegates autocomplete to its own hook. */
function useChatInput(props: ChatInputProps) {
  const initial = props.initialValue ?? "";
  const [value, setValue] = useState(initial);
  const [escPending, setEscPending] = useState(false);
  const valueRef = useRef(initial);

  const showAutocomplete = shouldShowAutocomplete(
    value,
    props.autocompleteItems,
  );

  const autocomplete = useAutocompleteNavigation(
    props.autocompleteItems,
    value.startsWith("/") ? value.slice(1) : "",
    showAutocomplete,
  );

  /** Updates value in both state (for rendering) and ref (for callbacks). */
  function handleChange(newValue: string) {
    valueRef.current = newValue;
    setValue(newValue);
    setEscPending(false);
    autocomplete.reset();
  }

  /** Submits the current value if non-empty, then clears the input. */
  function handleSubmit() {
    if (showAutocomplete) {
      // showAutocomplete guarantees filtered items exist and selectedIndex is valid.
      const selected = autocomplete.select();
      /* v8 ignore next -- selectedIndex is always in bounds */
      if (!selected) return;
      const filled = `/${selected.name} `;
      handleChange(filled);
      setCursorPos(filled.length);
      return;
    }

    const current = valueRef.current;
    if (current.trim() === "") {
      return;
    }
    props.onMessage(current);
    handleChange("");
    setCursorPos(0);
  }

  /** Handles escape: first press shows hint, second press clears input. */
  function handleEscape() {
    if (escPending) {
      handleChange("");
      setCursorPos(0);
      return;
    }
    if (valueRef.current.length > 0) {
      setEscPending(true);
    }
  }

  /** Navigates autocomplete up or passes to history. */
  function handleUp() {
    if (showAutocomplete) {
      autocomplete.moveUp();
      return;
    }
    props.onUp?.(valueRef.current);
  }

  /** Navigates autocomplete down. Only called when captureUpDown (showAutocomplete) is true. */
  function handleDown() {
    autocomplete.moveDown();
  }

  const { cursor, setCursor: setCursorPos } = useTextInput({
    value,
    onChange: handleChange,
    onSubmit: handleSubmit,
    lineMode: "multi",
    onUp: handleUp,
    onDown: handleDown,
    onEscape: handleEscape,
    captureUpDown: showAutocomplete,
  });

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
    cursor,
    escPending,
    instructions,
    showAutocomplete,
    autocomplete,
  };
}

/** Splits a value around a cursor position for rendering. */
export function splitAtCursor(
  value: string,
  cursor: number,
): { before: string; at: string; after: string } {
  const charAtCursor = value[cursor];
  const showPlaceholder = charAtCursor === undefined || charAtCursor === "\n";
  return {
    before: value.slice(0, cursor),
    at: showPlaceholder ? " " : charAtCursor,
    after: showPlaceholder ? value.slice(cursor) : value.slice(cursor + 1),
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
      <Text color={theme.brand}>{buildBorder()}</Text>
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
      <Text color={theme.brand}>{buildBorder()}</Text>
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions items={instructions} />
      </Box>
      {showAutocomplete && <AutocompleteList autocomplete={autocomplete} />}
    </Box>
  );
}
