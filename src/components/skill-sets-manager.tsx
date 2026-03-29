import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import {
  cloneSource,
  type DiscoveredSkillSet,
  discoverSkillSets,
} from "../skill-sets/sources";
import { useListNavigation } from "../hooks/use-list-navigation";
import { HintBar } from "./hint-bar";
import type { SettingsState } from "./settings-selector";
import { SkillSetSourcesEditor } from "./skill-set-sources-editor";

export interface SkillSetsManagerProps {
  state: SettingsState;
  onUpdate: (partial: Partial<SettingsState>) => void;
  onBack: () => void;
}

type Step = "list" | "sources";

/** Skill sets manager with toggle list and source management sub-menu. */
export function SkillSetsManager({
  state,
  onUpdate,
  onBack,
}: SkillSetsManagerProps) {
  const [step, setStep] = useState<Step>("list");
  const [discovered, setDiscovered] = useState<DiscoveredSkillSet[]>([]);
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Clone sources and discover skill sets on mount / when sources change.
  useEffect(() => {
    setLoading(true);
    const allSets: DiscoveredSkillSet[] = [];
    const failed: string[] = [];

    for (const source of state.skillSetSources) {
      try {
        cloneSource(source.url);
        allSets.push(...discoverSkillSets(source.url));
      } catch {
        failed.push(source.url);
      }
    }

    setDiscovered(allSets);
    setFailedSources(failed);
    setLoading(false);
  }, [state.skillSetSources]);

  // +1 for "Manage Sources" row at the bottom.
  const itemCount = discovered.length + 1;
  const { cursor, handleUp, handleDown } = useListNavigation(itemCount);

  const isEnabled = (set: DiscoveredSkillSet) =>
    state.enabledSkillSets.some(
      (e) => e.sourceUrl === set.sourceUrl && e.name === set.name,
    );

  const toggleSet = (set: DiscoveredSkillSet) => {
    if (isEnabled(set)) {
      onUpdate({
        enabledSkillSets: state.enabledSkillSets.filter(
          (e) => !(e.sourceUrl === set.sourceUrl && e.name === set.name),
        ),
      });
    } else {
      onUpdate({
        enabledSkillSets: [
          ...state.enabledSkillSets,
          { sourceUrl: set.sourceUrl, name: set.name },
        ],
      });
    }
  };

  useInput(
    (input, key) => {
      if (step !== "list") return;

      if (key.escape) {
        onBack();
        return;
      }

      const isOnManageSources = cursor === discovered.length;

      if (key.upArrow) {
        handleUp();
      } else if (key.downArrow) {
        handleDown();
      } else if (input === " " && !isOnManageSources) {
        toggleSet(discovered[cursor]);
      } else if (key.return && isOnManageSources) {
        setStep("sources");
      }
    },
    { isActive: step === "list" },
  );

  if (step === "sources") {
    return (
      <SkillSetSourcesEditor
        state={state}
        onUpdate={onUpdate}
        onBack={() => setStep("list")}
      />
    );
  }

  if (loading) {
    return (
      <Box flexDirection="column">
        <Text dimColor>{"  Loading skill sets..."}</Text>
      </Box>
    );
  }

  const maxName = Math.max(...discovered.map((s) => s.name.length), 0);

  return (
    <Box flexDirection="column">
      <HintBar
        label="Skill Sets"
        hints={[
          { key: "Space", action: "toggle" },
          { key: "Enter", action: "select" },
          { key: "Esc", action: "back" },
        ]}
      />
      <Text>{""}</Text>
      {failedSources.length > 0 &&
        failedSources.map((url) => (
          <Text key={url} color="yellow">
            {"    ⚠ Failed to clone: "}
            {url}
          </Text>
        ))}
      {discovered.length === 0 && failedSources.length === 0 && (
        <Text dimColor>{"    No skill sets found. Add sources first."}</Text>
      )}
      {discovered.map((set, i) => {
        const isCurrent = i === cursor;
        const enabled = isEnabled(set);
        const desc = set.description || "<no description>";
        return (
          <Text key={`${set.sourceUrl}:${set.name}`}>
            {"    "}
            <Text color={isCurrent ? "cyan" : undefined}>
              {isCurrent ? "❯" : " "}
            </Text>{" "}
            {enabled ? (
              <Text color="green">[✔]</Text>
            ) : (
              <Text dimColor>[ ]</Text>
            )}{" "}
            <Text color="cyan">{set.name.padEnd(maxName)}</Text>
            <Text color="cyan" dimColor>
              {"  "}
              {desc}
            </Text>
          </Text>
        );
      })}
      <Text>{""}</Text>
      {(() => {
        const isCurrent = cursor === discovered.length;
        return (
          <Text color={isCurrent ? "cyan" : "dim"}>
            {"    "}
            {isCurrent ? "❯" : " "} Manage Sources...
          </Text>
        );
      })()}
    </Box>
  );
}
