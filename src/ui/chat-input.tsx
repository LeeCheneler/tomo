import { Box, Text, useInput } from "ink";
import { useRef, useState } from "react";
import { theme } from "./theme";

/** Props for the ChatInput component. */
export interface ChatInputProps {
  /** Current text value of the input. */
  value: string;
  /** Called when the input value changes. */
  onChange: (value: string) => void;
  /** Called when the user submits the input. */
  onSubmit: (value: string) => void;
  /** Status text displayed right-aligned on the bottom border. */
  statusText: string;
}

/** Returns the terminal width, defaulting to 80 if unavailable. */
function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}

/** Builds a full-width border line of ─ characters. */
function buildTopBorder(): string {
  return "─".repeat(getTerminalWidth());
}

/** Builds a bottom border with optional right-aligned status text. */
function buildBottomBorder(statusText: string): string {
  const width = getTerminalWidth();

  if (!statusText) {
    return "─".repeat(width);
  }

  // Status sits near the right edge: ───statusText──
  const trailingSuffix = "──";
  const statusSegment = `${statusText}${trailingSuffix}`;
  const leadingLength = width - statusSegment.length;
  return `${"─".repeat(leadingLength)}${statusSegment}`;
}

/** Tracks cursor position within the input value using a ref for immediate access in callbacks. */
function useCursor(valueLength: number) {
  const ref = useRef(valueLength);
  const [, rerender] = useState(0);

  // Clamp cursor to valid range on each render.
  ref.current = Math.max(0, Math.min(ref.current, valueLength));

  /** Updates cursor position and triggers a re-render. */
  function setCursor(pos: number) {
    ref.current = pos;
    rerender((n) => n + 1);
  }

  /** Returns the current cursor position (always fresh, safe in callbacks). */
  function getCursor() {
    return ref.current;
  }

  return { cursor: ref.current, getCursor, setCursor };
}

/** Handles keyboard input and dispatches onChange/onSubmit. */
function useChatInputKeys(
  props: ChatInputProps,
  getCursor: () => number,
  setCursor: (pos: number) => void,
) {
  useInput((input, key) => {
    const cursor = getCursor();

    if (key.return) {
      props.onSubmit(props.value);
      return;
    }

    // macOS Backspace sends \x7f which Ink maps to key.delete.
    if (key.backspace || key.delete) {
      if (cursor > 0) {
        const before = props.value.slice(0, cursor - 1);
        const after = props.value.slice(cursor);
        props.onChange(before + after);
        setCursor(cursor - 1);
      }
      return;
    }

    // Ignore control sequences that aren't printable characters.
    if (key.ctrl || key.meta || key.escape) {
      return;
    }

    if (key.leftArrow) {
      setCursor(cursor - 1);
      return;
    }

    if (key.rightArrow) {
      setCursor(cursor + 1);
      return;
    }

    // Ignore remaining special keys.
    if (key.upArrow || key.downArrow || key.tab) {
      return;
    }

    const before = props.value.slice(0, cursor);
    const after = props.value.slice(cursor);
    props.onChange(before + input + after);
    setCursor(cursor + input.length);
  });
}

/** Chat input with bordered text area and status ribbon. */
export function ChatInput(props: ChatInputProps) {
  const { cursor, getCursor, setCursor } = useCursor(props.value.length);
  useChatInputKeys(props, getCursor, setCursor);

  const beforeCursor = props.value.slice(0, cursor);
  const atCursor = props.value[cursor] ?? " ";
  const afterCursor = props.value.slice(cursor + 1);

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Text color={theme.brand}>{buildTopBorder()}</Text>
      <Text>
        <Text color={theme.brand}>{"❯ "}</Text>
        {beforeCursor}
        <Text inverse>{atCursor}</Text>
        {afterCursor}
      </Text>
      <Text color={theme.brand}>{buildBottomBorder(props.statusText)}</Text>
    </Box>
  );
}
