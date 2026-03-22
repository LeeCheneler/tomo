import { useState } from "react";
import { Box, Text, useInput } from "ink";

interface ToolSelectorProps {
  tools: string[];
  currentAvailability: Record<string, boolean>;
  warnings?: Record<string, string>;
  onSave: (availability: Record<string, boolean>) => void;
  onCancel: () => void;
}

/** Interactive tool enable/disable UI for the /tools command. */
export function ToolSelector({
  tools,
  currentAvailability,
  warnings,
  onSave,
  onCancel,
}: ToolSelectorProps) {
  const [cursor, setCursor] = useState(0);
  const [availability, setAvailability] = useState({
    ...currentAvailability,
  });

  useInput((input, key) => {
    if (key.escape) {
      onSave(availability);
      return;
    }

    if (input === "q" || input === "Q") {
      onCancel();
      return;
    }

    if (key.upArrow) {
      setCursor((c) => (c > 0 ? c - 1 : tools.length - 1));
      return;
    }

    if (key.downArrow) {
      setCursor((c) => (c < tools.length - 1 ? c + 1 : 0));
      return;
    }

    if (input === " " || key.return) {
      const name = tools[cursor];
      setAvailability((prev) => ({
        ...prev,
        [name]: !prev[name],
      }));
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold color="yellow">
        {"  Tool Availability"}
      </Text>
      <Text>{""}</Text>
      {tools.map((name, i) => {
        const isCurrent = i === cursor;
        const enabled = availability[name] ?? true;
        const warning = enabled ? warnings?.[name] : undefined;

        return (
          <Box key={name} flexDirection="column">
            <Text color={isCurrent ? "cyan" : undefined}>
              {"  "}
              {isCurrent ? "❯" : " "} {enabled ? "[✔]" : "[ ]"} {name}
            </Text>
            {warning && (
              <Text color="yellow">
                {"      ⚠ "}
                {warning}
              </Text>
            )}
          </Box>
        );
      })}
      <Text>{""}</Text>
      <Text dimColor>
        {"  ↑↓ navigate, Space/Enter toggle, Esc save & close, q cancel"}
      </Text>
    </Box>
  );
}
