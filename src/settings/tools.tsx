import { Box, Text } from "ink";
import { useState } from "react";
import { useConfig } from "../config/hook";
import type { Tools } from "../config/schema";
import { updateTools } from "../config/updaters";
import { Border } from "../ui/border";
import type { FormField, FormValues } from "../ui/form";
import { Form } from "../ui/form";
import type { InstructionItem } from "../ui/key-instructions";
import { KeyInstructions } from "../ui/key-instructions";
import { Indent } from "../ui/layout/indent";
import type { ToggleListItem } from "../ui/toggle-list";
import { ToggleList } from "../ui/toggle-list";
import { theme } from "../ui/theme";

/** Tool keys matching the config schema. */
type ToolKey = keyof Tools;

/** Display order and labels for tools. */
const TOOL_ITEMS: readonly {
  key: ToolKey;
  label: string;
  hasOptions: boolean;
}[] = [
  { key: "agent", label: "Agent", hasOptions: false },
  { key: "ask", label: "Ask", hasOptions: false },
  { key: "editFile", label: "Edit File", hasOptions: false },
  { key: "glob", label: "Glob", hasOptions: false },
  { key: "grep", label: "Grep", hasOptions: false },
  { key: "readFile", label: "Read File", hasOptions: false },
  { key: "runCommand", label: "Run Command", hasOptions: false },
  { key: "skill", label: "Skill", hasOptions: false },
  { key: "webSearch", label: "Web Search", hasOptions: true },
  { key: "writeFile", label: "Write File", hasOptions: false },
];

/** Key instructions for the tools list screen. */
const LIST_INSTRUCTIONS: InstructionItem[] = [
  { key: "up/down", description: "navigate" },
  { key: "space", description: "toggle" },
  { key: "tab", description: "options" },
  { key: "esc", description: "back" },
];

/** Key instructions for the tool options form. */
const OPTIONS_INSTRUCTIONS: InstructionItem[] = [
  { key: "up/down", description: "navigate" },
  { key: "space", description: "toggle" },
  { key: "enter", description: "save" },
  { key: "esc", description: "cancel" },
];

/** Builds toggle list items from tools config. */
function buildToggleItems(tools: Tools): ToggleListItem[] {
  return TOOL_ITEMS.map((item) => ({
    key: item.key,
    label: item.label,
    value: tools[item.key].enabled,
    hasOptions: item.hasOptions,
  }));
}

/** Builds form fields for a tool's options. Only webSearch has options currently. */
function buildFormFields(tools: Tools): FormField[] {
  return [
    {
      type: "toggle",
      key: "enabled",
      label: "Enabled",
      initialValue: tools.webSearch.enabled,
    },
    {
      type: "text",
      key: "apiKey",
      label: "API Key",
      initialValue: tools.webSearch.apiKey ?? "",
    },
  ];
}

/** Applies form values back to the tools config. Only webSearch has options currently. */
function applyFormValues(tools: Tools, formValues: FormValues): Tools {
  const apiKey = formValues.apiKey as string;
  return {
    ...tools,
    webSearch: {
      ...tools.webSearch,
      enabled: formValues.enabled as boolean,
      apiKey: apiKey || undefined,
    },
  };
}

/** Props for ToolsScreen. */
export interface ToolsScreenProps {
  onBack: () => void;
}

/** Active tool being edited, or null when on the toggle list. */
interface ActiveToolOptions {
  key: ToolKey;
  label: string;
}

/** Manages tools state, persistence, and sub-screen routing. */
function useToolsScreen(props: ToolsScreenProps) {
  const { config } = useConfig();
  const [tools, setTools] = useState<Tools>(() => config.tools);
  const [activeOptions, setActiveOptions] = useState<ActiveToolOptions | null>(
    null,
  );

  /** Toggles a tool's enabled state and saves to local config. */
  function handleToggle(key: string, value: boolean) {
    const toolKey = key as ToolKey;
    const updated = {
      ...tools,
      [toolKey]: { ...tools[toolKey], enabled: value },
    };
    setTools(updated);
    updateTools(updated);
  }

  /** Opens the options form for a tool. */
  function handleOptions(key: string) {
    const toolKey = key as ToolKey;
    const item = TOOL_ITEMS.find((t) => t.key === toolKey);
    /* v8 ignore next -- toolKey always matches a TOOL_ITEMS entry */
    if (!item) return;
    setActiveOptions({ key: toolKey, label: item.label });
  }

  /** Saves form values and returns to the toggle list. */
  function handleOptionsSubmit(formValues: FormValues) {
    /* v8 ignore next -- activeOptions is always set when this fires */
    if (!activeOptions) return;
    const updated = applyFormValues(tools, formValues);
    setTools(updated);
    updateTools(updated);
    setActiveOptions(null);
  }

  /** Discards changes and returns to the toggle list. */
  function handleOptionsCancel() {
    setActiveOptions(null);
  }

  return {
    tools,
    items: buildToggleItems(tools),
    activeOptions,
    handleToggle,
    handleOptions,
    handleOptionsSubmit,
    handleOptionsCancel,
    handleBack: props.onBack,
  };
}

/** Settings sub-screen for enabling and disabling tools. */
export function ToolsScreen(props: ToolsScreenProps) {
  const {
    tools,
    items,
    activeOptions,
    handleToggle,
    handleOptions,
    handleOptionsSubmit,
    handleOptionsCancel,
    handleBack,
  } = useToolsScreen(props);

  if (activeOptions) {
    const fields = buildFormFields(tools);
    return (
      <Box flexDirection="column" paddingTop={1}>
        <Border color={theme.settings} />
        <Indent>
          <Text bold>{activeOptions.label} Options</Text>
        </Indent>
        <Form
          fields={fields}
          onSubmit={handleOptionsSubmit}
          onCancel={handleOptionsCancel}
          color={theme.settings}
        />
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
        <Text bold>Tools</Text>
      </Indent>
      <ToggleList
        items={items}
        onToggle={handleToggle}
        onExit={handleBack}
        onOptions={handleOptions}
        color={theme.settings}
      />
      <Border color={theme.settings} />
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions items={LIST_INSTRUCTIONS} />
      </Box>
    </Box>
  );
}
