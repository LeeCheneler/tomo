import { Box, Text, useInput } from "ink";
import { useState } from "react";

interface AskSelectorProps {
  question: string;
  options: string[];
  onSelect: (answer: string) => void;
  onCancel: () => void;
}

/** Interactive multiple-choice selector with a free-text "Other" option. */
export function AskSelector({
  question,
  options,
  onSelect,
  onCancel,
}: AskSelectorProps) {
  // Append the "Other" escape hatch — always last.
  const allOptions = [...options, "Other (type your answer)"];
  const [cursor, setCursor] = useState(0);
  const [typing, setTyping] = useState(false);
  const [customValue, setCustomValue] = useState("");

  useInput((input, key) => {
    if (key.escape) {
      if (typing) {
        setTyping(false);
        setCustomValue("");
        return;
      }
      onCancel();
      return;
    }

    if (typing) {
      if (key.return) {
        if (customValue.trim()) {
          onSelect(customValue.trim());
        }
        return;
      }
      if (key.backspace || key.delete) {
        setCustomValue((v) => v.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setCustomValue((v) => v + input);
      }
      return;
    }

    if (key.return) {
      if (cursor === allOptions.length - 1) {
        // "Other" selected — switch to text input mode
        setTyping(true);
        return;
      }
      onSelect(options[cursor]);
      return;
    }

    if (key.upArrow) {
      setCursor((c) => (c > 0 ? c - 1 : allOptions.length - 1));
    }
    if (key.downArrow) {
      setCursor((c) => (c < allOptions.length - 1 ? c + 1 : 0));
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        {"  "}
        {question}
      </Text>
      <Text dimColor>{"  (↑↓ navigate, Enter select, Esc cancel)"}</Text>
      {allOptions.map((option, i) => {
        const isCursor = i === cursor;
        const prefix = isCursor ? "❯" : " ";
        return (
          <Text key={option} color={isCursor ? "cyan" : undefined}>
            {"  "}
            {prefix} {option}
          </Text>
        );
      })}
      {typing ? (
        <Box marginTop={1}>
          <Text>
            {"  > "}
            {customValue}
            <Text inverse> </Text>
          </Text>
        </Box>
      ) : null}
    </Box>
  );
}
