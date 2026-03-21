import { useState } from "react";
import chalk from "chalk";
import { Box, Text, useInput } from "ink";

interface CommandConfirmProps {
  command: string;
  onApprove: () => void;
  onDeny: () => void;
}

/** Confirmation prompt for a CLI command. Approve/Deny with arrow keys, Enter, or y/n shortcuts. */
export function CommandConfirm({
  command,
  onApprove,
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

    if (key.return) {
      if (cursor === 0) {
        onApprove();
      } else {
        onDeny();
      }
      return;
    }

    if (key.upArrow || key.downArrow) {
      setCursor((c) => (c === 0 ? 1 : 0));
    }
  });

  return (
    <Box flexDirection="column">
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
      <Text color={cursor === 1 ? "red" : undefined}>
        {"  "}
        {cursor === 1 ? "❯" : " "} Deny (n)
      </Text>
    </Box>
  );
}
