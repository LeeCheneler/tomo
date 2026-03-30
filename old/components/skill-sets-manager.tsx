import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import {
  cloneSource,
  type DiscoveredSkillSet,
  discoverSkillSets,
  pullSource,
} from "../skill-sets/sources";
import { reloadSkills } from "../skills";
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

interface UpdateResult {
  url: string;
  ok: boolean;
  error?: string;
}

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
  const [updateResults, setUpdateResults] = useState<UpdateResult[] | null>(
    null,
  );

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

  const refreshDiscovered = () => {
    const allSets: DiscoveredSkillSet[] = [];
    for (const source of state.skillSetSources) {
      try {
        allSets.push(...discoverSkillSets(source.url));
      } catch {
        // already handled by failedSources
      }
    }
    setDiscovered(allSets);
    reloadSkills();
  };

  const handleUpdateSources = () => {
    const results: UpdateResult[] = [];
    for (const source of state.skillSetSources) {
      try {
        pullSource(source.url);
        results.push({ url: source.url, ok: true });
      } catch (e) {
        results.push({
          url: source.url,
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
    setUpdateResults(results);
    refreshDiscovered();
  };

  // +2 for "Update Sources" and "Manage Sources" rows at the bottom.
  const actionRows = 2;
  const itemCount = discovered.length + actionRows;
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

  const isOnUpdateSources = cursor === discovered.length;
  const isOnManageSources = cursor === discovered.length + 1;

  useInput(
    (input, key) => {
      if (step !== "list") return;

      if (key.escape) {
        onBack();
        return;
      }

      if (key.upArrow) {
        handleUp();
      } else if (key.downArrow) {
        handleDown();
      } else if (input === " " && !isOnUpdateSources && !isOnManageSources) {
        toggleSet(discovered[cursor]);
      } else if (key.return && isOnUpdateSources) {
        handleUpdateSources();
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
      <Text color={isOnUpdateSources ? "cyan" : "dim"}>
        {"    "}
        {isOnUpdateSources ? "❯" : " "} Update Sources...
      </Text>
      <Text color={isOnManageSources ? "cyan" : "dim"}>
        {"    "}
        {isOnManageSources ? "❯" : " "} Manage Sources...
      </Text>
      {updateResults && (
        <Box flexDirection="column" marginTop={1}>
          {updateResults.map((r) => (
            <Text key={r.url} color={r.ok ? "green" : "red"}>
              {"    "}
              {r.ok ? "✔" : "✗"} {r.url}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
}
