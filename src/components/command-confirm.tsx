import { useState } from "react";
import chalk from "chalk";
import { Box, Text, useInput } from "ink";

interface CommandConfirmProps {
  command: string;
  isDestructive?: boolean;
  onApprove: () => void;
  onApproveAlways: () => void;
  onDeny: () => void;
}

/** Confirmation prompt for a CLI command. Three options with arrow keys, Enter, or shortcut keys. */
export function CommandConfirm({
  command,
  isDestructive,
  onApprove,
  onApproveAlways,
  onDeny,
}: CommandConfirmProps) {
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    if (key.escape || input === "n" || input === "N") {
      onDeny();
      return;
    }

    if (input === "y" || input === "Y") {
      onApprove();
      return;
    }

    if (input === "a" || input === "A") {
      onApproveAlways();
      return;
    }

    if (key.return) {
      if (cursor === 0) onApprove();
      else if (cursor === 1) onApproveAlways();
      else onDeny();
      return;
    }

    if (key.upArrow) {
      setCursor((c) => (c > 0 ? c - 1 : 2));
      return;
    }

    if (key.downArrow) {
      setCursor((c) => (c < 2 ? c + 1 : 0));
    }
  });

  return (
    <Box flexDirection="column">
      {isDestructive && (
        <Text bold color="red">
          {"  ⚠ Destructive command detected"}
        </Text>
      )}
      <Text bold color="yellow">
        {"  Run this command?"}
      </Text>
      <Text>{""}</Text>
      <Text>
        {"  "}
        {chalk.bold(`> ${command}`)}
      </Text>
      <Text>{""}</Text>
      <Text color={cursor === 0 ? "green" : undefined}>
        {"  "}
        {cursor === 0 ? "❯" : " "} Approve (y)
      </Text>
      <Text color={cursor === 1 ? "cyan" : undefined}>
        {"  "}
        {cursor === 1 ? "❯" : " "} Approve Always (a)
      </Text>
      <Text color={cursor === 2 ? "red" : undefined}>
        {"  "}
        {cursor === 2 ? "❯" : " "} Deny (n)
      </Text>
    </Box>
  );
}
