import chalk from "chalk";
import { Text } from "ink";
import { ConfirmPrompt } from "./confirm-prompt";

interface CommandConfirmProps {
  command: string;
  onApprove: () => void;
  onApproveAlways: () => void;
  onDeny: () => void;
}

/** Confirmation prompt for a CLI command. Three options with arrow keys, Enter, or shortcut keys. */
export function CommandConfirm({
  command,
  onApprove,
  onApproveAlways,
  onDeny,
}: CommandConfirmProps) {
  return (
    <ConfirmPrompt
      title="Run this command?"
      options={[
        {
          label: "Approve",
          shortcut: "y",
          color: "green",
          onSelect: onApprove,
        },
        {
          label: "Approve Always",
          shortcut: "a",
          color: "cyan",
          onSelect: onApproveAlways,
        },
        { label: "Deny", shortcut: "n", color: "red", onSelect: onDeny },
      ]}
    >
      <Text>{""}</Text>
      <Text>
        {"  "}
        {chalk.bold(`> ${command}`)}
      </Text>
    </ConfirmPrompt>
  );
}
