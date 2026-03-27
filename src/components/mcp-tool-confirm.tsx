import chalk from "chalk";
import { Text } from "ink";
import { ConfirmPrompt } from "./confirm-prompt.js";

interface McpToolConfirmProps {
  serverName: string;
  toolName: string;
  args: Record<string, unknown>;
  onApprove: () => void;
  onDeny: () => void;
}

/** Confirmation prompt for MCP tool calls. */
export function McpToolConfirm({
  serverName,
  toolName,
  args,
  onApprove,
  onDeny,
}: McpToolConfirmProps) {
  const argsSummary = Object.entries(args)
    .map(([k, v]) => {
      const val = typeof v === "string" ? v : JSON.stringify(v);
      const display = val.length > 60 ? `${val.slice(0, 60)}…` : val;
      return `    ${k}: ${display}`;
    })
    .join("\n");

  return (
    <ConfirmPrompt
      title={`MCP tool call: ${serverName}/${toolName}`}
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
        {chalk.dim("server:")} {chalk.bold(serverName)}
      </Text>
      <Text>
        {"  "}
        {chalk.dim("tool:")} {chalk.bold(toolName)}
      </Text>
      {argsSummary ? (
        <Text>
          {"  "}
          {chalk.dim("args:")}
          {"\n"}
          {argsSummary}
        </Text>
      ) : null}
      <Text>{""}</Text>
    </ConfirmPrompt>
  );
}
