import { Box, Text } from "ink";
import { useRef, useState } from "react";
import { useTextInput } from "../input/text";
import type { AutocompleteItem } from "./autocomplete";
import { AutocompleteList } from "./autocomplete";
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
  items?: readonly AutocompleteItem[],
): boolean {
  if (!items || items.length === 0) return false;
  // Show when starts with / but not // (skills), and no space yet (still typing command name).
  return (
    value.startsWith("/") && !value.startsWith("//") && !value.includes(" ")
  );
}

/** Manages chat input state, submission, and autocomplete navigation. */
function useChatInput(props: ChatInputProps) {
  const initial = props.initialValue ?? "";
  const [value, setValue] = useState(initial);
  const [escPending, setEscPending] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  // Ref keeps value fresh across batched React updates so submit
  // always sees the latest input even before re-render.
  const valueRef = useRef(initial);

  const showAutocomplete = shouldShowAutocomplete(
    value,
    props.autocompleteItems,
  );

  /** Updates value in both state (for rendering) and ref (for callbacks). */
  function handleChange(newValue: string) {
    valueRef.current = newValue;
    setValue(newValue);
    setEscPending(false);
    setSelectedIndex(0);
  }

  /** Submits the current value if non-empty, then clears the input. */
  function handleSubmit() {
    if (showAutocomplete && props.autocompleteItems) {
      // Fill selected command into input instead of submitting.
      // showAutocomplete guarantees items exist and selectedIndex is valid
      // (reset to 0 on every change, loops within bounds).
      const filtered = props.autocompleteItems
        .filter((item) =>
          item.name.toLowerCase().includes(value.slice(1).toLowerCase()),
        )
        .sort((a, b) => a.name.localeCompare(b.name));
      const filled = `/${filtered[selectedIndex].name} `;
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
      // showAutocomplete guarantees autocompleteItems exists with length > 0.
      const count = props.autocompleteItems.length;
      setSelectedIndex((i) => (i - 1 + count) % count);
      return;
    }
    props.onUp?.(valueRef.current);
  }

  /** Navigates autocomplete down. */
  function handleDown() {
    /* v8 ignore next -- showAutocomplete gates all callers */
    if (showAutocomplete) {
      const count = props.autocompleteItems.length;
      setSelectedIndex((i) => (i + 1) % count);
    }
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

  const hasContent = value.length > 0;
  const instructions = [
    (hasContent || escPending) && {
      key: "enter",
      description: showAutocomplete ? "select" : "submit",
    },
    (hasContent || escPending) && {
      key: "escape",
      description: escPending ? "confirm" : "clear",
    },
    showAutocomplete && { key: "up/down", description: "navigate" },
    !showAutocomplete &&
      props.hasHistory &&
      cursor === 0 && { key: "up", description: "history" },
  ].filter((i): i is InstructionItem => Boolean(i));

  return { value, cursor, instructions, showAutocomplete, selectedIndex };
}

/** Splits a value around a cursor position for rendering. */
export function splitAtCursor(
  value: string,
  cursor: number,
): { before: string; at: string; after: string } {
  const charAtCursor = value[cursor];
  // Newlines and end-of-value are invisible — show a space block instead.
  // When on a newline, keep it in after so line breaks aren't lost.
  const showPlaceholder = charAtCursor === undefined || charAtCursor === "\n";
  return {
    before: value.slice(0, cursor),
    at: showPlaceholder ? " " : charAtCursor,
    after: showPlaceholder ? value.slice(cursor) : value.slice(cursor + 1),
  };
}

/** Chat input with bordered text area and inline autocomplete. */
export function ChatInput(props: ChatInputProps) {
  const { value, cursor, instructions, showAutocomplete, selectedIndex } =
    useChatInput(props);
  const { before, at, after } = splitAtCursor(value, cursor);

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Text color={theme.brand}>{buildBorder()}</Text>
      <Box>
        <Text color={theme.brand}>{"❯ "}</Text>
        <Text>
          {before}
          <Text inverse>{at}</Text>
          {after}
        </Text>
      </Box>
      <Text color={theme.brand}>{buildBorder()}</Text>
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions items={instructions} />
      </Box>
      {showAutocomplete && (
        <AutocompleteList
          items={props.autocompleteItems}
          filter={value.slice(1)}
          selectedIndex={selectedIndex}
        />
      )}
    </Box>
  );
}
