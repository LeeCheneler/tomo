import { useState } from "react";
import { Box, Text, useInput } from "ink";

interface ChatInputProps {
  onSubmit: (text: string) => void;
  disabled?: boolean;
  onEscape?: () => void;
}

/** Text input with Enter to submit, Shift+Enter for newline, and Escape to cancel. */
export function ChatInput({ onSubmit, disabled, onEscape }: ChatInputProps) {
  const [value, setValue] = useState("");

  useInput((input, key) => {
    if (key.escape) {
      onEscape?.();
      return;
    }

    if (disabled) return;

    if (key.return) {
      if (key.shift) {
        setValue((v) => `${v}\n`);
      } else if (value.trim()) {
        onSubmit(value);
        setValue("");
      }
      return;
    }

    if (key.backspace || key.delete) {
      setValue((v) => v.slice(0, -1));
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      setValue((v) => v + input);
    }
  });

  return (
    <Box flexDirection="column">
      <Text dimColor>{"─".repeat((process.stdout.columns || 80) - 2)}</Text>
      <Box>
        <Text dimColor>{disabled ? "  " : "> "}</Text>
        <Text>{value}</Text>
      </Box>
      <Text dimColor>{"─".repeat((process.stdout.columns || 80) - 2)}</Text>
    </Box>
  );
}
