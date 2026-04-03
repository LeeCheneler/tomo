import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type { InstructionItem } from "../ui/key-instructions";
import { KeyInstructions } from "../ui/key-instructions";
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

  const instructions: InstructionItem[] = [
    { key: "up/down", description: "scroll" },
    { key: "esc", description: "return to draft" },
    { key: "enter", description: "replace draft" },
  ];

  return { selectedEntry: props.entries[index], instructions };
}

/** Displays a single history entry with bordered layout for browsing. */
export function MessageHistory(props: MessageHistoryProps) {
  const { selectedEntry, instructions } = useMessageHistory(props);

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Text color={theme.history}>{buildBorder()}</Text>
      <Text>
        <Text color={theme.history}>{"❯ "}</Text>
        {selectedEntry}
      </Text>
      <Text color={theme.history}>{buildBorder()}</Text>
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions items={instructions} />
      </Box>
    </Box>
  );
}
