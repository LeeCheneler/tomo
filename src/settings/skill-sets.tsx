import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { useConfig } from "../config/hook";
import type { SkillSetSource } from "../config/schema";
import {
  addSkillSetSource,
  removeSkillSetSource,
  updateSkillSetEnabledSets,
} from "../config/updaters";
import { cloneSource, pullSource, removeSource } from "../skill-sets/git";
import { discoverSkillSets } from "../skill-sets/loader";
import type { DiscoveredSkillSet } from "../skill-sets/loader";
import { Border } from "../ui/border";
import type { EditableListItem } from "../ui/editable-list";
import { EditableList } from "../ui/editable-list";
import type { InstructionItem } from "../ui/key-instructions";
import { KeyInstructions } from "../ui/key-instructions";
import { Indent } from "../ui/layout/indent";
import { theme } from "../ui/theme";
import type { ToggleListItem } from "../ui/toggle-list";
import { ToggleList } from "../ui/toggle-list";

/** Key instructions for the source list. */
const LIST_INSTRUCTIONS: InstructionItem[] = [
  { key: "up/down", description: "navigate" },
  { key: "enter", description: "save/add/remove" },
  { key: "tab", description: "options" },
  { key: "esc", description: "back" },
];

/** Key instructions for the source options screen. */
const OPTIONS_INSTRUCTIONS: InstructionItem[] = [
  { key: "up/down", description: "navigate" },
  { key: "space", description: "toggle" },
  { key: "u", description: "update" },
  { key: "esc", description: "back" },
];

/** Props for SkillSetsScreen. */
export interface SkillSetsScreenProps {
  onBack: () => void;
}

/** Clone status for feedback after add or update. */
interface CloneStatus {
  url: string;
  status: "ok" | "error";
  message?: string;
}

/** Builds editable list items from sources. */
function buildItems(sources: SkillSetSource[]): EditableListItem[] {
  return sources.map((s) => ({ value: s.url, hasOptions: true }));
}

/** Builds toggle list items from discovered sets and enabled sets. */
function buildToggleItems(
  discovered: DiscoveredSkillSet[],
  enabledSets: string[],
): ToggleListItem[] {
  return discovered.map((set) => ({
    key: set.name,
    label: set.description ? `${set.name} — ${set.description}` : set.name,
    value: enabledSets.includes(set.name),
  }));
}

/** Manages skill set source list state, cloning, and options routing. */
function useSkillSetsScreen(props: SkillSetsScreenProps) {
  const { config, reload } = useConfig();
  const [sources, setSources] = useState<SkillSetSource[]>(
    () => config.skillSets.sources,
  );
  const [activeOptions, setActiveOptions] = useState<number | null>(null);
  const [cloneStatus, setCloneStatus] = useState<CloneStatus | null>(null);

  /** Adds a source URL, clones the repo, and saves to config. */
  function handleAdd(url: string) {
    const source: SkillSetSource = { url, enabledSets: [] };
    addSkillSetSource(source);
    reload();
    setSources((prev) => [...prev, source]);

    try {
      cloneSource(url);
      setCloneStatus({ url, status: "ok" });
    } catch {
      setCloneStatus({ url, status: "error", message: "Failed to clone" });
    }
  }

  /** Removes a source by index, deletes the clone, and saves to config. */
  function handleRemove(index: number) {
    const url = sources[index].url;
    removeSkillSetSource(url);
    removeSource(url);
    reload();
    setSources((prev) => prev.filter((_, i) => i !== index));
    setCloneStatus(null);
  }

  /** Renames a source URL at the given index. */
  function handleUpdate(index: number, newUrl: string) {
    const oldUrl = sources[index].url;
    removeSkillSetSource(oldUrl);
    removeSource(oldUrl);
    const updated: SkillSetSource = { url: newUrl, enabledSets: [] };
    addSkillSetSource(updated);
    reload();
    setSources((prev) => prev.map((s, i) => (i === index ? updated : s)));

    try {
      cloneSource(newUrl);
      setCloneStatus({ url: newUrl, status: "ok" });
    } catch {
      setCloneStatus({
        url: newUrl,
        status: "error",
        message: "Failed to clone",
      });
    }
  }

  /** Opens the options screen for a source. */
  function handleOptions(index: number) {
    setActiveOptions(index);
    setCloneStatus(null);
  }

  /** Toggles a set on/off for a source by URL. */
  function handleToggle(
    sourceUrl: string,
    currentSets: string[],
    setName: string,
    enabled: boolean,
  ) {
    const enabledSets = enabled
      ? [...currentSets, setName]
      : currentSets.filter((s) => s !== setName);
    updateSkillSetEnabledSets(sourceUrl, enabledSets);
    reload();
    setSources((prev) =>
      prev.map((s) => (s.url === sourceUrl ? { ...s, enabledSets } : s)),
    );
  }

  /** Pulls latest changes for a source by URL. */
  function handlePull(url: string) {
    try {
      pullSource(url);
      setCloneStatus({ url, status: "ok", message: "Updated" });
    } catch {
      setCloneStatus({ url, status: "error", message: "Failed to update" });
    }
  }

  /** Returns to the source list from options. */
  function handleOptionsBack() {
    setActiveOptions(null);
    setCloneStatus(null);
  }

  return {
    sources,
    items: buildItems(sources),
    activeOptions,
    cloneStatus,
    handleAdd,
    handleRemove,
    handleUpdate,
    handleOptions,
    handleToggle,
    handlePull,
    handleOptionsBack,
    handleBack: props.onBack,
  };
}

/** Options sub-screen for a skill set source — toggle sets and update. */
function SourceOptionsScreen(props: {
  source: SkillSetSource;
  cloneStatus: CloneStatus | null;
  onToggle: (
    sourceUrl: string,
    currentSets: string[],
    key: string,
    value: boolean,
  ) => void;
  onPull: (sourceUrl: string) => void;
  onBack: () => void;
}) {
  const discovered = discoverSkillSets(props.source.url);
  const toggleItems = buildToggleItems(discovered, props.source.enabledSets);

  /** Wraps onToggle to include the source URL and current enabled sets. */
  function handleToggle(key: string, value: boolean) {
    props.onToggle(props.source.url, props.source.enabledSets, key, value);
  }

  useInput((input, key) => {
    if (key.escape) {
      props.onBack();
      return;
    }
    if (input === "u" || input === "U") {
      props.onPull(props.source.url);
    }
  });

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Border color={theme.settings} />
      <Indent>
        <Text bold>{props.source.url}</Text>
      </Indent>
      {discovered.length === 0 ? (
        <Indent>
          <Text dimColor>No skill sets found in this source</Text>
        </Indent>
      ) : (
        <ToggleList
          items={toggleItems}
          onToggle={handleToggle}
          onExit={props.onBack}
          color={theme.settings}
        />
      )}
      {props.cloneStatus && (
        <Indent>
          <Text
            color={
              props.cloneStatus.status === "ok" ? theme.success : theme.error
            }
          >
            {props.cloneStatus.message}
          </Text>
        </Indent>
      )}
      <Border color={theme.settings} />
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions items={OPTIONS_INSTRUCTIONS} />
      </Box>
    </Box>
  );
}

/** Settings sub-screen for managing skill set sources. */
export function SkillSetsScreen(props: SkillSetsScreenProps) {
  const {
    sources,
    items,
    activeOptions,
    cloneStatus,
    handleAdd,
    handleRemove,
    handleUpdate,
    handleOptions,
    handleToggle,
    handlePull,
    handleOptionsBack,
    handleBack,
  } = useSkillSetsScreen(props);

  if (activeOptions !== null) {
    return (
      <SourceOptionsScreen
        source={sources[activeOptions]}
        cloneStatus={cloneStatus}
        onToggle={handleToggle}
        onPull={handlePull}
        onBack={handleOptionsBack}
      />
    );
  }

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Border color={theme.settings} />
      <Indent>
        <Text bold>Skill Sets</Text>
      </Indent>
      <Indent>
        <Text dimColor>
          Add git repo URLs, e.g. git@github.com:org/skills.git
        </Text>
      </Indent>
      <EditableList
        items={items}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onUpdate={handleUpdate}
        onOptions={handleOptions}
        onExit={handleBack}
        color={theme.settings}
        placeholder="Add source..."
      />
      {cloneStatus && (
        <Indent>
          <Text
            color={cloneStatus.status === "ok" ? theme.success : theme.error}
          >
            {cloneStatus.status === "ok"
              ? `Cloned ${cloneStatus.url}`
              : `${cloneStatus.message}: ${cloneStatus.url}`}
          </Text>
        </Indent>
      )}
      <Border color={theme.settings} />
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions items={LIST_INSTRUCTIONS} />
      </Box>
    </Box>
  );
}
