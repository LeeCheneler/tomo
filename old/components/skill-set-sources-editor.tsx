import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { removeSource } from "../skill-sets/sources";
import { useListNavigation } from "../hooks/use-list-navigation";
import { HintBar } from "./hint-bar";
import type { SettingsState } from "./settings-selector";
import { TextInput } from "./text-input";

export interface SkillSetSourcesEditorProps {
  state: SettingsState;
  onUpdate: (partial: Partial<SettingsState>) => void;
  onBack: () => void;
}

/** Skill set sources editor with add/delete for git repo URLs. */
export function SkillSetSourcesEditor({
  state,
  onUpdate,
  onBack,
}: SkillSetSourcesEditorProps) {
  const [adding, setAdding] = useState(false);
  const [newEntry, setNewEntry] = useState("");

  const itemCount = state.skillSetSources.length + 1; // +1 for Add row
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
        if (trimmed && !state.skillSetSources.some((s) => s.url === trimmed)) {
          onUpdate({
            skillSetSources: [...state.skillSetSources, { url: trimmed }],
          });
        }
        setAdding(false);
        setNewEntry("");
        return;
      }
      return;
    }

    if (key.escape) {
      onBack();
      return;
    }

    const isOnAdd = cursor === state.skillSetSources.length;

    if (key.upArrow) {
      handleUp();
    } else if (key.downArrow) {
      handleDown();
    } else if ((input === "d" || input === "D") && !isOnAdd) {
      const deletedUrl = state.skillSetSources[cursor].url;
      removeSource(deletedUrl);
      onUpdate({
        skillSetSources: state.skillSetSources.filter((_, i) => i !== cursor),
        enabledSkillSets: state.enabledSkillSets.filter(
          (s) => s.sourceUrl !== deletedUrl,
        ),
      });
      if (cursor >= itemCount - 1) {
        setCursor((c) => Math.max(0, c - 1));
      }
    } else if (
      input === "a" ||
      input === "A" ||
      ((input === " " || key.return) && isOnAdd)
    ) {
      setCursor(state.skillSetSources.length);
      setAdding(true);
    }
  });

  return (
    <Box flexDirection="column">
      <HintBar
        label="Skill Set Sources"
        hints={[
          { key: "d", action: "delete" },
          { key: "a", action: "add" },
          { key: "Esc", action: "back" },
        ]}
      />
      <Text dimColor>
        {"  Add git repo URLs, e.g. git@github.com:org/repo.git"}
      </Text>
      <Text>{""}</Text>
      {state.skillSetSources.map((source, i) => {
        const isCurrent = i === cursor;
        return (
          <Text key={source.url} color={isCurrent ? "cyan" : undefined}>
            {"    "}
            {isCurrent ? "❯" : " "} {source.url}
          </Text>
        );
      })}
      {(() => {
        const isCurrent = cursor === state.skillSetSources.length;
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
