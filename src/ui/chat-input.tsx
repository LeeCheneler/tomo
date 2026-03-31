import { Box, Text } from "ink";
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

/** Stateless chat input with bordered text area and status ribbon. */
export function ChatInput(props: ChatInputProps) {
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
