import { Box, Text } from "ink";
import { useState } from "react";
import { loadConfig } from "../config/file";
import type { Provider } from "../config/schema";
import {
  addProvider,
  removeProvider,
  updateProvider,
} from "../config/updaters";
import { PROVIDER_DEFAULT_URLS } from "../provider/client";
import { Border } from "../ui/border";
import type { EditableListItem } from "../ui/editable-list";
import { EditableList } from "../ui/editable-list";
import type { InstructionItem } from "../ui/key-instructions";
import { KeyInstructions } from "../ui/key-instructions";
import { Indent } from "../ui/layout/indent";
import { theme } from "../ui/theme";

/** Key instructions for the providers list. */
const INSTRUCTIONS: InstructionItem[] = [
  { key: "up/down", description: "navigate" },
  { key: "enter", description: "save/add/remove" },
  { key: "tab", description: "options" },
  { key: "esc", description: "back" },
];

/** Props for ProvidersScreen. */
export interface ProvidersScreenProps {
  onBack: () => void;
}

/** Builds editable list items from providers. */
function buildItems(providers: Provider[]): EditableListItem[] {
  return providers.map((p) => ({ value: p.name, hasOptions: true }));
}

/** Manages provider list state and persistence. */
function useProvidersScreen(props: ProvidersScreenProps) {
  const [providers, setProviders] = useState<Provider[]>(
    () => loadConfig().providers,
  );

  /** Adds a new provider with ollama defaults and saves to global config. */
  function handleAdd(name: string) {
    const provider: Provider = {
      name,
      type: "ollama",
      baseUrl: PROVIDER_DEFAULT_URLS.ollama,
    };
    addProvider(provider);
    setProviders((prev) => [...prev, provider]);
  }

  /** Removes a provider by index and saves to global config. */
  function handleRemove(index: number) {
    const name = providers[index].name;
    removeProvider(name);
    setProviders((prev) => prev.filter((_, i) => i !== index));
  }

  /** Renames a provider at the given index and saves to global config. */
  function handleUpdate(index: number, newName: string) {
    const original = providers[index];
    const updated = { ...original, name: newName };
    updateProvider(original.name, updated);
    setProviders((prev) => prev.map((p, i) => (i === index ? updated : p)));
  }

  return {
    items: buildItems(providers),
    handleAdd,
    handleRemove,
    handleUpdate,
    handleBack: props.onBack,
  };
}

/** Settings sub-screen for managing provider connections. */
export function ProvidersScreen(props: ProvidersScreenProps) {
  const { items, handleAdd, handleRemove, handleUpdate, handleBack } =
    useProvidersScreen(props);

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Border color={theme.settings} />
      <Indent>
        <Text bold>Providers</Text>
      </Indent>
      <EditableList
        items={items}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onUpdate={handleUpdate}
        onExit={handleBack}
        color={theme.settings}
        placeholder="Add provider..."
      />
      <Border color={theme.settings} />
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions items={INSTRUCTIONS} />
      </Box>
    </Box>
  );
}
