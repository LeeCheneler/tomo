import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { theme } from "../ui/theme";

/** Props for the MessageHistory component. */
export interface MessageHistoryProps {
  /** History entries to navigate through. */
  entries: readonly string[];
  /** Called when the user selects an entry with Enter. */
  onSelected: (entry: string) => void;
  /** Called when the user exits history (down past last entry or Escape). */
  onExit: () => void;
}

/** Returns the terminal width, defaulting to 80 if unavailable. */
function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}

/** Builds a full-width border line of ─ characters. */
function buildBorder(): string {
  return "─".repeat(getTerminalWidth());
}

/** Manages the selected index within history entries. */
function useMessageHistory(props: MessageHistoryProps) {
  const [index, setIndex] = useState(props.entries.length - 1);

  useInput((_input, key) => {
    if (key.return) {
      props.onSelected(props.entries[index]);
      return;
    }

    if (key.escape) {
      props.onExit();
      return;
    }

    if (key.upArrow) {
      setIndex((i) => Math.max(0, i - 1));
      return;
    }

    if (key.downArrow) {
      if (index >= props.entries.length - 1) {
        props.onExit();
      } else {
        setIndex((i) => i + 1);
      }
      return;
    }
  });

  return { selectedEntry: props.entries[index] };
}

/** Displays a single history entry with bordered layout for browsing. */
export function MessageHistory(props: MessageHistoryProps) {
  const { selectedEntry } = useMessageHistory(props);

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Text bold color={theme.brand}>
        {buildBorder()}
      </Text>
      <Text>
        <Text bold color={theme.brand}>
          {"↑ "}
        </Text>
        {selectedEntry}
      </Text>
      <Text bold color={theme.brand}>
        {buildBorder()}
      </Text>
    </Box>
  );
}
