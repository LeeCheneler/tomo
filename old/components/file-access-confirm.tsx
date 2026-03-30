import chalk from "chalk";
import { Text } from "ink";
import { ConfirmPrompt } from "./confirm-prompt";

interface FileAccessConfirmProps {
  filePath: string;
  action: string;
  onApprove: () => void;
  onDeny: () => void;
}

/** Generic confirmation prompt for file access operations. */
export function FileAccessConfirm({
  filePath,
  action,
  onApprove,
  onDeny,
}: FileAccessConfirmProps) {
  return (
    <ConfirmPrompt
      title={action}
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
        {chalk.bold(filePath)}
      </Text>
      <Text>{""}</Text>
    </ConfirmPrompt>
  );
}
