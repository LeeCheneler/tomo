import { Box, Text } from "ink";
import { useState } from "react";
import { loadConfig } from "../config/file";
import type { Provider, ProviderType } from "../config/schema";
import {
  addProvider,
  removeProvider,
  updateProvider,
} from "../config/updaters";
import { API_KEY_ENV_VARS, PROVIDER_DEFAULT_URLS } from "../provider/client";
import { Border } from "../ui/border";
import type { EditableListItem } from "../ui/editable-list";
import { EditableList } from "../ui/editable-list";
import type { FormField, FormValues } from "../ui/form";
import { Form } from "../ui/form";
import type { InstructionItem } from "../ui/key-instructions";
import { KeyInstructions } from "../ui/key-instructions";
import { Indent } from "../ui/layout/indent";
import { theme } from "../ui/theme";

/** Supported provider type values for the select field. */
const PROVIDER_TYPES: readonly ProviderType[] = [
  "ollama",
  "opencode-zen",
  "openrouter",
];

/** Key instructions for the providers list. */
const LIST_INSTRUCTIONS: InstructionItem[] = [
  { key: "up/down", description: "navigate" },
  { key: "enter", description: "save/add/remove" },
  { key: "tab", description: "options" },
  { key: "esc", description: "back" },
];

/** Key instructions for the provider options form. */
const OPTIONS_INSTRUCTIONS: InstructionItem[] = [
  { key: "up/down", description: "navigate" },
  { key: "left/right", description: "select" },
  { key: "enter", description: "save" },
  { key: "esc", description: "cancel" },
];

/** Builds form fields for editing a provider's options. */
function buildFormFields(provider: Provider): FormField[] {
  return [
    {
      type: "select",
      key: "type",
      label: "Type",
      options: PROVIDER_TYPES,
      initialValue: provider.type,
    },
    {
      type: "text",
      key: "name",
      label: "Name",
      initialValue: provider.name,
    },
    {
      type: "text",
      key: "baseUrl",
      label: "Base URL",
      initialValue: provider.baseUrl,
    },
    {
      type: "text",
      key: "apiKey",
      label: "API Key",
      initialValue: provider.apiKey ?? "",
    },
  ];
}

/** Converts form values to a Provider object. */
function formValuesToProvider(values: FormValues): Provider {
  const apiKey = values.apiKey as string;
  return {
    name: values.name as string,
    type: values.type as ProviderType,
    baseUrl: values.baseUrl as string,
    apiKey: apiKey || undefined,
  };
}

/** Props for ProvidersScreen. */
export interface ProvidersScreenProps {
  onBack: () => void;
}

/** Builds editable list items from providers. */
function buildItems(providers: Provider[]): EditableListItem[] {
  return providers.map((p) => ({ value: p.name, hasOptions: true }));
}

/** Manages provider list state, persistence, and options form routing. */
function useProvidersScreen(props: ProvidersScreenProps) {
  const [providers, setProviders] = useState<Provider[]>(
    () => loadConfig().providers,
  );
  const [activeOptions, setActiveOptions] = useState<number | null>(null);

  /** Adds a new provider with ollama defaults and opens its options form. */
  function handleAdd(name: string) {
    const provider: Provider = {
      name,
      type: "ollama",
      baseUrl: PROVIDER_DEFAULT_URLS.ollama,
    };
    addProvider(provider);
    const updated = [...providers, provider];
    setProviders(updated);
    setActiveOptions(updated.length - 1);
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

  /** Opens the options form for a provider. */
  function handleOptions(index: number) {
    setActiveOptions(index);
  }

  /** Saves the options form and returns to the list. */
  function handleOptionsSubmit(values: FormValues) {
    /* v8 ignore next -- activeOptions is always set when this fires */
    if (activeOptions === null) return;
    const original = providers[activeOptions];
    const updated = formValuesToProvider(values);
    updateProvider(original.name, updated);
    setProviders((prev) =>
      prev.map((p, i) => (i === activeOptions ? updated : p)),
    );
    setActiveOptions(null);
  }

  /** Discards changes and returns to the list. */
  function handleOptionsCancel() {
    setActiveOptions(null);
  }

  return {
    providers,
    items: buildItems(providers),
    activeOptions,
    handleAdd,
    handleRemove,
    handleUpdate,
    handleOptions,
    handleOptionsSubmit,
    handleOptionsCancel,
    handleBack: props.onBack,
  };
}

/** Settings sub-screen for managing provider connections. */
export function ProvidersScreen(props: ProvidersScreenProps) {
  const {
    providers,
    items,
    activeOptions,
    handleAdd,
    handleRemove,
    handleUpdate,
    handleOptions,
    handleOptionsSubmit,
    handleOptionsCancel,
    handleBack,
  } = useProvidersScreen(props);

  if (activeOptions !== null) {
    const provider = providers[activeOptions];
    const fields = buildFormFields(provider);
    return (
      <Box flexDirection="column" paddingTop={1}>
        <Border color={theme.settings} />
        <Indent>
          <Text bold>{provider.name} Options</Text>
        </Indent>
        <Form
          fields={fields}
          onSubmit={handleOptionsSubmit}
          onCancel={handleOptionsCancel}
          color={theme.settings}
        />
        <Indent>
          <Text dimColor>
            API Key defaults to ${API_KEY_ENV_VARS[provider.type]} environment
            variable
          </Text>
        </Indent>
        <Border color={theme.settings} />
        <Box justifyContent="flex-end" height={1}>
          <KeyInstructions items={OPTIONS_INSTRUCTIONS} />
        </Box>
      </Box>
    );
  }

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
        onOptions={handleOptions}
        onExit={handleBack}
        color={theme.settings}
        placeholder="Add provider..."
      />
      <Border color={theme.settings} />
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions items={LIST_INSTRUCTIONS} />
      </Box>
    </Box>
  );
}
