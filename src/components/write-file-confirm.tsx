import { useState } from "react";
import chalk from "chalk";
import { Box, Text, useInput } from "ink";

interface WriteFileConfirmProps {
  filePath: string;
  isNewFile: boolean;
  diffPreview: string;
  onApprove: () => void;
  onDeny: () => void;
}

/** Confirmation prompt for writing a file. Shows path, status, and diff preview. */
export function WriteFileConfirm({
  filePath,
  isNewFile,
  diffPreview,
  onApprove,
  onDeny,
}: WriteFileConfirmProps) {
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

  const status = isNewFile ? chalk.green("new file") : chalk.yellow("modified");

  return (
    <Box flexDirection="column">
      <Text bold color="yellow">
        {"  Write to file?"}
      </Text>
      <Text>{""}</Text>
      <Text>
        {"  "}
        {chalk.bold(filePath)} ({status})
      </Text>
      <Text>{""}</Text>
      <Text>{diffPreview}</Text>
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
