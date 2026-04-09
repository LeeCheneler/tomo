import { Box, Text } from "ink";
import { useState } from "react";
import { useConfig } from "../config/hook";
import { updateAllowedCommands } from "../config/updaters";
import { Border } from "../ui/border";
import { EditableList } from "../ui/editable-list";
import { KeyInstructions } from "../ui/key-instructions";
import { Indent } from "../ui/layout/indent";
import { theme } from "../ui/theme";

/** Props for AllowedCommandsScreen. */
export interface AllowedCommandsScreenProps {
  onBack: () => void;
}

/** Manages allowed commands state and persistence. */
function useAllowedCommandsScreen(props: AllowedCommandsScreenProps) {
  const { config, reload } = useConfig();
  const [commands, setCommands] = useState<string[]>(
    () => config.allowedCommands,
  );
  const [enterAction, setEnterAction] = useState<"save" | "remove">("save");

  /** Adds a command and saves to local config. */
  function handleAdd(value: string) {
    const updated = [...commands, value];
    setCommands(updated);
    updateAllowedCommands(updated);
    reload();
  }

  /** Removes a command by index and saves to local config. */
  function handleRemove(index: number) {
    const updated = commands.filter((_, i) => i !== index);
    setCommands(updated);
    updateAllowedCommands(updated);
    reload();
  }

  /** Updates a command at the given index and saves to local config. */
  function handleUpdate(index: number, value: string) {
    const updated = commands.map((cmd, i) => (i === index ? value : cmd));
    setCommands(updated);
    updateAllowedCommands(updated);
    reload();
  }

  return {
    commands,
    enterAction,
    setEnterAction,
    handleAdd,
    handleRemove,
    handleUpdate,
    handleBack: props.onBack,
  };
}

/** Settings sub-screen for editing allowed commands. */
export function AllowedCommandsScreen(props: AllowedCommandsScreenProps) {
  const {
    commands,
    enterAction,
    setEnterAction,
    handleAdd,
    handleRemove,
    handleUpdate,
    handleBack,
  } = useAllowedCommandsScreen(props);

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Border color={theme.settings} />
      <Indent>
        <Text bold>Allowed Commands</Text>
      </Indent>
      <Indent>
        <Text dimColor>Exact match (npm test) or prefix with :* (git:*)</Text>
      </Indent>
      <Indent>
        <Text dimColor>Clear text and press enter to remove</Text>
      </Indent>
      <EditableList
        items={commands.map((c) => ({ value: c }))}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onUpdate={handleUpdate}
        onExit={handleBack}
        onEnterActionChange={setEnterAction}
        color={theme.settings}
        placeholder="Add command..."
      />
      <Border color={theme.settings} />
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions
          items={[
            { key: "enter", description: enterAction },
            { key: "esc", description: "back" },
          ]}
        />
      </Box>
    </Box>
  );
}
