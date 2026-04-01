import { Box, Text } from "ink";
import { useRef, useState } from "react";
import { useTextInput } from "../input/text";
import { theme } from "../ui/theme";

/** Props for the ChatInput component. */
export interface ChatInputProps {
  /** Called when the user submits a message. */
  onMessage: (message: string) => void;
  /** Called when up arrow is pressed at the start of the input. */
  onUp?: () => void;
  /** Initial text to populate the input with on mount. */
  initialValue?: string;
}

/** Returns the terminal width, defaulting to 80 if unavailable. */
function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}

/** Builds a full-width border line of ─ characters. */
function buildBorder(): string {
  return "─".repeat(getTerminalWidth());
}

/** Manages chat input state and submission. */
function useChatInput(props: ChatInputProps) {
  const initial = props.initialValue ?? "";
  const [value, setValue] = useState(initial);
  const [escPending, setEscPending] = useState(false);
  // Ref keeps value fresh across batched React updates so submit
  // always sees the latest input even before re-render.
  const valueRef = useRef(initial);

  /** Updates value in both state (for rendering) and ref (for callbacks). */
  function handleChange(newValue: string) {
    valueRef.current = newValue;
    setValue(newValue);
    setEscPending(false);
  }

  /** Submits the current value if non-empty, then clears the input. */
  function handleSubmit() {
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

  const { cursor, setCursor: setCursorPos } = useTextInput({
    value,
    onChange: handleChange,
    onSubmit: handleSubmit,
    lineMode: "multi",
    onUp: props.onUp,
    onEscape: handleEscape,
  });

  return { value, cursor, escPending };
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

/** Builds a right-aligned hint string padded to the terminal width. */
function buildEscapeHint(): string {
  const hint = "Escape again to clear";
  const width = getTerminalWidth();
  const padding = Math.max(0, width - hint.length);
  return " ".repeat(padding) + hint;
}

/** Chat input with bordered text area. */
export function ChatInput(props: ChatInputProps) {
  const { value, cursor, escPending } = useChatInput(props);
  const { before, at, after } = splitAtCursor(value, cursor);

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Text color={theme.brand}>{buildBorder()}</Text>
      <Text>
        <Text color={theme.brand}>{"❯ "}</Text>
        {before}
        <Text inverse>{at}</Text>
        {after}
      </Text>
      <Text color={theme.brand}>{buildBorder()}</Text>
      {escPending && <Text dimColor>{buildEscapeHint()}</Text>}
    </Box>
  );
}
