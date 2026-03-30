import { Box, Text, useInput } from "ink";
import { useListNavigation } from "../hooks/use-list-navigation";
import type { CheckboxItem } from "./checkbox-list";
import { HintBar } from "./hint-bar";
import type { SettingsState, ToolMeta } from "./settings-selector";

export interface ToolAvailabilityEditorProps {
  state: SettingsState;
  toolMeta: ToolMeta;
  onUpdate: (partial: Partial<SettingsState>) => void;
  onBack: () => void;
}

/** Tool availability editor for built-in tools. */
export function ToolAvailabilityEditor({
  state,
  toolMeta,
  onUpdate,
  onBack,
}: ToolAvailabilityEditorProps) {
  const { cursor, handleUp, handleDown } = useListNavigation(
    toolMeta.names.length,
  );

  useInput((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }

    if (key.upArrow) {
      handleUp();
    } else if (key.downArrow) {
      handleDown();
    } else if (input === " ") {
      const name = toolMeta.names[cursor];
      onUpdate({
        toolAvailability: {
          ...state.toolAvailability,
          [name]: !state.toolAvailability[name],
        },
      });
    }
  });

  const items: CheckboxItem[] = toolMeta.names.map((name) => ({
    key: name,
    label: toolMeta.displayNames[name] ?? name,
    description: toolMeta.descriptions[name],
    checked: state.toolAvailability[name] ?? true,
    warning:
      (state.toolAvailability[name] ?? true)
        ? toolMeta.warnings[name]
        : undefined,
  }));

  const maxLabel = Math.max(...items.map((item) => item.label.length), 0);

  return (
    <Box flexDirection="column">
      <HintBar
        label="Tool Availability"
        hints={[
          { key: "Space", action: "toggle" },
          { key: "Esc", action: "back" },
        ]}
      />
      <Text>{""}</Text>
      {items.map((item, i) => {
        const isCurrent = i === cursor;
        return (
          <Box key={item.key} flexDirection="column">
            <Text>
              {"    "}
              <Text color={isCurrent ? "cyan" : undefined}>
                {isCurrent ? "❯" : " "}
              </Text>{" "}
              {item.checked ? (
                <Text color="green">[✔]</Text>
              ) : (
                <Text dimColor>[ ]</Text>
              )}{" "}
              <Text color="cyan">{item.label.padEnd(maxLabel)}</Text>
              {item.description && (
                <Text color="cyan" dimColor>
                  {"  "}
                  {item.description}
                </Text>
              )}
            </Text>
            {item.warning && (
              <Text color="yellow">
                {"        ⚠ "}
                {item.warning}
              </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
