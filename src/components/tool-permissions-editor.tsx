import { Box, Text, useInput } from "ink";
import { useListNavigation } from "../hooks/use-list-navigation";
import { type CheckboxItem, CheckboxList } from "./checkbox-list";
import type { SettingsState } from "./settings-selector";

interface PermissionRow {
  key: string;
  displayName: string;
  description: string;
}

const PERMISSION_ROWS: PermissionRow[] = [
  {
    key: "read_file",
    displayName: "Read File",
    description: "Read files in current directory (Tomo only)",
  },
  {
    key: "write_file",
    displayName: "Write File",
    description: "Write and edit files in current directory (Tomo only)",
  },
];

export interface ToolPermissionsEditorProps {
  state: SettingsState;
  onUpdate: (partial: Partial<SettingsState>) => void;
  onBack: () => void;
}

/** Tool permissions editor for file access auto-approve. */
export function ToolPermissionsEditor({
  state,
  onUpdate,
  onBack,
}: ToolPermissionsEditorProps) {
  const { cursor, handleUp, handleDown } = useListNavigation(
    PERMISSION_ROWS.length,
  );

  useInput((input, key) => {
    if (key.escape || input === "q" || input === "Q") {
      onBack();
      return;
    }

    if (key.upArrow) {
      handleUp();
    } else if (key.downArrow) {
      handleDown();
    } else if (input === " " || key.return) {
      const row = PERMISSION_ROWS[cursor];
      onUpdate({
        permissions: {
          ...state.permissions,
          [row.key]: !state.permissions[row.key],
        },
      });
    }
  });

  const items: CheckboxItem[] = PERMISSION_ROWS.map((perm) => ({
    key: perm.key,
    label: perm.displayName,
    description: perm.description,
    checked: state.permissions[perm.key] ?? false,
  }));

  return (
    <Box flexDirection="column">
      <Text dimColor>
        {"  Tool Permissions (Space/Enter toggle, Esc back):"}
      </Text>
      <Text>{""}</Text>
      <CheckboxList items={items} cursor={cursor} />
    </Box>
  );
}
