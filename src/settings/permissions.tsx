import { Box, Text } from "ink";
import { useState } from "react";
import { loadConfig } from "../config/file";
import type { Permissions } from "../config/schema";
import { updatePermissions } from "../config/updaters";
import { Border } from "../ui/border";
import type { InstructionItem } from "../ui/key-instructions";
import { KeyInstructions } from "../ui/key-instructions";
import { Indent } from "../ui/layout/indent";
import type { ToggleListItem } from "../ui/toggle-list";
import { ToggleList } from "../ui/toggle-list";
import { theme } from "../ui/theme";

/** Permission keys matching the config schema. */
type PermissionKey = keyof Permissions;

/** Display order and labels for permissions. */
const PERMISSION_ITEMS: readonly { key: PermissionKey; label: string }[] = [
  { key: "cwdReadFile", label: "Read files (current directory)" },
  { key: "cwdWriteFile", label: "Write files (current directory)" },
  { key: "globalReadFile", label: "Read files (global)" },
  { key: "globalWriteFile", label: "Write files (global)" },
];

/** Key instructions for the permissions screen. */
const INSTRUCTIONS: InstructionItem[] = [
  { key: "up/down", description: "navigate" },
  { key: "space", description: "toggle" },
  { key: "esc", description: "back" },
];

/** Builds toggle list items from permissions config. */
function buildToggleItems(permissions: Permissions): ToggleListItem[] {
  return PERMISSION_ITEMS.map((item) => ({
    key: item.key,
    label: item.label,
    value: permissions[item.key] ?? false,
  }));
}

/** Props for PermissionsScreen. */
export interface PermissionsScreenProps {
  onBack: () => void;
}

/** Manages permissions state and persistence. */
function usePermissionsScreen(props: PermissionsScreenProps) {
  const [permissions, setPermissions] = useState<Permissions>(() => {
    return loadConfig().permissions;
  });

  /** Toggles a permission and saves to local config. */
  function handleToggle(key: string, value: boolean) {
    const updated = { ...permissions, [key]: value };
    setPermissions(updated);
    updatePermissions(updated);
  }

  return {
    items: buildToggleItems(permissions),
    handleToggle,
    handleBack: props.onBack,
  };
}

/** Settings sub-screen for editing file access permissions. */
export function PermissionsScreen(props: PermissionsScreenProps) {
  const { items, handleToggle, handleBack } = usePermissionsScreen(props);

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Border color={theme.settings} />
      <Indent>
        <Text bold>Permissions</Text>
      </Indent>
      <ToggleList
        items={items}
        onToggle={handleToggle}
        onExit={handleBack}
        color={theme.settings}
      />
      <Border color={theme.settings} />
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions items={INSTRUCTIONS} />
      </Box>
    </Box>
  );
}
