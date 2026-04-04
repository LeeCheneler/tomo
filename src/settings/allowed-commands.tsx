import { Box, Text } from "ink";
import { useState } from "react";
import { loadConfig } from "../config/file";
import { updateAllowedCommands } from "../config/updaters";
import { Border } from "../ui/border";
import { EditableList } from "../ui/editable-list";
import type { InstructionItem } from "../ui/key-instructions";
import { KeyInstructions } from "../ui/key-instructions";
import { Indent } from "../ui/layout/indent";
import { theme } from "../ui/theme";

/** Key instructions for the allowed commands screen. */
const INSTRUCTIONS: InstructionItem[] = [
  { key: "up/down", description: "navigate" },
  { key: "enter", description: "save/add/remove" },
  { key: "esc", description: "back" },
];

/** Props for AllowedCommandsScreen. */
export interface AllowedCommandsScreenProps {
  onBack: () => void;
}

/** Manages allowed commands state and persistence. */
function useAllowedCommandsScreen(props: AllowedCommandsScreenProps) {
  const [commands, setCommands] = useState<string[]>(() => {
    return loadConfig().allowedCommands;
  });

  /** Adds a command and saves to local config. */
  function handleAdd(value: string) {
    const updated = [...commands, value];
    setCommands(updated);
    updateAllowedCommands(updated);
  }

  /** Removes a command by index and saves to local config. */
  function handleRemove(index: number) {
    const updated = commands.filter((_, i) => i !== index);
    setCommands(updated);
    updateAllowedCommands(updated);
  }

  /** Updates a command at the given index and saves to local config. */
  function handleUpdate(index: number, value: string) {
    const updated = commands.map((cmd, i) => (i === index ? value : cmd));
    setCommands(updated);
    updateAllowedCommands(updated);
  }

  return {
    commands,
    handleAdd,
    handleRemove,
    handleUpdate,
    handleBack: props.onBack,
  };
}

/** Settings sub-screen for editing allowed commands. */
export function AllowedCommandsScreen(props: AllowedCommandsScreenProps) {
  const { commands, handleAdd, handleRemove, handleUpdate, handleBack } =
    useAllowedCommandsScreen(props);

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Border color={theme.settings} />
      <Indent>
        <Text bold>Allowed Commands</Text>
      </Indent>
      <Indent>
        <Text dimColor>Exact match (npm test) or prefix with :* (git:*)</Text>
      </Indent>
      <EditableList
        items={commands.map((c) => ({ value: c }))}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onUpdate={handleUpdate}
        onExit={handleBack}
        color={theme.settings}
        placeholder="Add command..."
      />
      <Border color={theme.settings} />
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions items={INSTRUCTIONS} />
      </Box>
    </Box>
  );
}
