import { Box, Text, useInput } from "ink";
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

/** Handles keyboard input and dispatches onChange/onSubmit. */
function useChatInputKeys(props: ChatInputProps) {
  useInput((input, key) => {
    if (key.return) {
      props.onSubmit(props.value);
      return;
    }

    // macOS Backspace sends \x7f which Ink maps to key.delete.
    if (key.backspace || key.delete) {
      if (props.value.length > 0) {
        props.onChange(props.value.slice(0, -1));
      }
      return;
    }

    // Ignore control sequences that aren't printable characters.
    if (key.ctrl || key.meta || key.escape) {
      return;
    }

    // Ignore arrow keys and other special keys.
    if (
      key.upArrow ||
      key.downArrow ||
      key.leftArrow ||
      key.rightArrow ||
      key.tab
    ) {
      return;
    }

    props.onChange(props.value + input);
  });
}

/** Chat input with bordered text area and status ribbon. */
export function ChatInput(props: ChatInputProps) {
  useChatInputKeys(props);

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Text color={theme.brand}>{buildTopBorder()}</Text>
      <Text>
        <Text color={theme.brand}>{"❯ "}</Text>
        {props.value}
      </Text>
      <Text color={theme.brand}>{buildBottomBorder(props.statusText)}</Text>
    </Box>
  );
}
