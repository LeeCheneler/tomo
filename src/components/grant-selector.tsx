import { useState } from "react";
import { Box, Text, useInput } from "ink";

interface PermissionRow {
  key: string;
  label: string;
}

const ROWS: PermissionRow[] = [
  { key: "read_file", label: "read files in current directory" },
  { key: "write_file", label: "write files in current directory" },
  { key: "edit_file", label: "edit files in current directory" },
];

interface GrantSelectorProps {
  currentPermissions: Record<string, boolean>;
  onSave: (permissions: Record<string, boolean>) => void;
  onCancel: () => void;
}

/** Interactive permission toggle UI for the /grant command. */
export function GrantSelector({
  currentPermissions,
  onSave,
  onCancel,
}: GrantSelectorProps) {
  const [cursor, setCursor] = useState(0);
  const [permissions, setPermissions] = useState({ ...currentPermissions });

  useInput((input, key) => {
    if (key.escape) {
      onSave(permissions);
      return;
    }

    if (input === "q" || input === "Q") {
      onCancel();
      return;
    }

    if (key.upArrow) {
      setCursor((c) => (c > 0 ? c - 1 : ROWS.length - 1));
      return;
    }

    if (key.downArrow) {
      setCursor((c) => (c < ROWS.length - 1 ? c + 1 : 0));
      return;
    }

    if (input === " " || key.return) {
      const row = ROWS[cursor];
      setPermissions((prev) => ({
        ...prev,
        [row.key]: !prev[row.key],
      }));
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold color="yellow">
        {"  Tool Permissions"}
      </Text>
      <Text>{""}</Text>
      {ROWS.map((row, i) => {
        const isCurrent = i === cursor;
        const enabled = permissions[row.key] ?? false;
        const maxKey = Math.max(...ROWS.map((r) => r.key.length));
        const paddedKey = row.key.padEnd(maxKey);

        return (
          <Text key={row.key} color={isCurrent ? "cyan" : undefined}>
            {"  "}
            {isCurrent ? "❯" : " "} {enabled ? "[✔]" : "[ ]"} {paddedKey}
            {"  "}
            {row.label}
          </Text>
        );
      })}
      <Text>{""}</Text>
      <Text dimColor>
        {"  ↑↓ navigate, Space/Enter toggle, Esc save & close, q cancel"}
      </Text>
    </Box>
  );
}
