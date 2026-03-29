import { Box, Text, useInput } from "ink";
import { useState } from "react";

interface AskSelectorProps {
  question: string;
  options: string[];
  onSelect: (answer: string) => void;
  onCancel: () => void;
}

/** Interactive multiple-choice selector with a free-text input as the last option. */
export function AskSelector({
  question,
  options,
  onSelect,
  onCancel,
}: AskSelectorProps) {
  const textInputIndex = options.length;
  const totalItems = options.length + 1;
  const [cursor, setCursor] = useState(
    options.length === 0 ? textInputIndex : 0,
  );
  const [customValue, setCustomValue] = useState("");

  // Typing mode is active when the cursor is on the text input row.
  const typing = cursor === textInputIndex;

  useInput((input, key) => {
    if (key.escape) {
      if (typing && customValue) {
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
      if (key.upArrow) {
        if (options.length > 0) {
          setCursor(textInputIndex - 1);
        }
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setCustomValue((v) => v + input);
      }
      return;
    }

    if (key.return) {
      onSelect(options[cursor]);
      return;
    }

    if (key.upArrow) {
      setCursor((c) => (c > 0 ? c - 1 : totalItems - 1));
    }
    if (key.downArrow) {
      setCursor((c) => (c < totalItems - 1 ? c + 1 : 0));
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        {"  "}
        {question}
      </Text>
      <Text dimColor>{"  (↑↓ navigate, Enter select, Esc cancel)"}</Text>
      {options.map((option, i) => {
        const isCursor = i === cursor;
        const prefix = isCursor ? "❯" : " ";
        return (
          <Text key={option} color={isCursor ? "cyan" : undefined}>
            {"  "}
            {prefix} {option}
          </Text>
        );
      })}
      <Text color={typing ? "cyan" : undefined}>
        {"  "}
        {typing ? "❯" : " "} {customValue}
        {typing ? <Text inverse> </Text> : null}
        {!typing && !customValue ? (
          <Text dimColor>Type your answer...</Text>
        ) : null}
      </Text>
    </Box>
  );
}
