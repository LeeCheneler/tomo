import chalk from "chalk";
import { Text } from "ink";
import { ConfirmPrompt } from "./confirm-prompt";

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
  const status = isNewFile ? chalk.green("new file") : chalk.yellow("modified");

  return (
    <ConfirmPrompt
      title="Write to file?"
      options={[
        {
          label: "Approve",
          shortcut: "y",
          color: "green",
          onSelect: onApprove,
        },
        { label: "Deny", shortcut: "n", color: "red", onSelect: onDeny },
      ]}
    >
      <Text>{""}</Text>
      <Text>
        {"  "}
        {chalk.bold(filePath)} ({status})
      </Text>
      <Text>{""}</Text>
      <Text>{diffPreview}</Text>
    </ConfirmPrompt>
  );
}
