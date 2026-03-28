import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { useListNavigation } from "../hooks/use-list-navigation";
import { HintBar } from "./hint-bar";
import type { SettingsState } from "./settings-selector";
import { TextInput } from "./text-input";

export interface AllowedCommandsEditorProps {
  state: SettingsState;
  onUpdate: (partial: Partial<SettingsState>) => void;
  onBack: () => void;
}

/** Allowed commands editor with add/delete. */
export function AllowedCommandsEditor({
  state,
  onUpdate,
  onBack,
}: AllowedCommandsEditorProps) {
  const [adding, setAdding] = useState(false);
  const [newEntry, setNewEntry] = useState("");

  const itemCount = state.allowedCommands.length + 1; // +1 for Add row
  const { cursor, setCursor, handleUp, handleDown } =
    useListNavigation(itemCount);

  useInput((input, key) => {
    if (adding) {
      if (key.escape) {
        setAdding(false);
        setNewEntry("");
        return;
      }
      if (key.return) {
        const trimmed = newEntry.trim();
        if (trimmed && !state.allowedCommands.includes(trimmed)) {
          onUpdate({
            allowedCommands: [...state.allowedCommands, trimmed],
          });
        }
        setAdding(false);
        setNewEntry("");
        return;
      }
      // TextInput component handles text editing via its own useInput
      return;
    }

    if (key.escape) {
      onBack();
      return;
    }

    const isOnAdd = cursor === state.allowedCommands.length;

    if (key.upArrow) {
      handleUp();
    } else if (key.downArrow) {
      handleDown();
    } else if ((input === "d" || input === "D") && !isOnAdd) {
      onUpdate({
        allowedCommands: state.allowedCommands.filter((_, i) => i !== cursor),
      });
      if (cursor >= itemCount - 1) {
        setCursor((c) => Math.max(0, c - 1));
      }
    } else if (input === "a" || input === "A" || (input === " " && isOnAdd)) {
      setCursor(state.allowedCommands.length);
      setAdding(true);
    }
  });

  return (
    <Box flexDirection="column">
      <HintBar
        label="Allowed Commands"
        hints={[
          { key: "d", action: "delete" },
          { key: "a", action: "add" },
          { key: "Esc", action: "back" },
        ]}
      />
      <Text dimColor>
        {"  Use exact commands (npm test) or prefixes (git:*)"}
      </Text>
      <Text>{""}</Text>
      {state.allowedCommands.map((cmd, i) => {
        const isCurrent = i === cursor;
        return (
          <Text key={cmd} color={isCurrent ? "cyan" : undefined}>
            {"    "}
            {isCurrent ? "❯" : " "} {cmd}
          </Text>
        );
      })}
      {(() => {
        const isCurrent = cursor === state.allowedCommands.length;
        if (adding) {
          return (
            <Box>
              <Text color="green">{"    ❯ [+] "}</Text>
              <TextInput value={newEntry} onChange={setNewEntry} />
            </Box>
          );
        }
        return (
          <Text color={isCurrent ? "cyan" : "dim"}>
            {"    "}
            {isCurrent ? "❯" : " "} [+] Add...
          </Text>
        );
      })()}
    </Box>
  );
}
