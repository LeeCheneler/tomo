import { type ReactNode, useState } from "react";
import { Box, Text, useInput } from "ink";

export interface ConfirmOption {
  label: string;
  shortcut: string;
  color: string;
  onSelect: () => void;
}

interface ConfirmPromptProps {
  title: string;
  children?: ReactNode;
  options: ConfirmOption[];
}

/** Generic confirmation prompt with keyboard-driven option selection. */
export function ConfirmPrompt({
  title,
  children,
  options,
}: ConfirmPromptProps) {
  const [cursor, setCursor] = useState(0);
  const lastIndex = options.length - 1;

  useInput((input, key) => {
    if (key.escape) {
      options[lastIndex].onSelect();
      return;
    }

    const lower = input.toLowerCase();
    const match = options.find((o) => o.shortcut.toLowerCase() === lower);
    if (match) {
      match.onSelect();
      return;
    }

    if (key.return) {
      options[cursor].onSelect();
      return;
    }

    if (key.upArrow) {
      setCursor((c) => (c > 0 ? c - 1 : lastIndex));
      return;
    }

    if (key.downArrow) {
      setCursor((c) => (c < lastIndex ? c + 1 : 0));
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold color="yellow">
        {`  ${title}`}
      </Text>
      {children}
      <Text>{""}</Text>
      {options.map((option, i) => (
        <Text
          key={option.shortcut}
          color={cursor === i ? option.color : undefined}
        >
          {"  "}
          {cursor === i ? "❯" : " "} {option.label} ({option.shortcut})
        </Text>
      ))}
    </Box>
  );
}
