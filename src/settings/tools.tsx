import { Box, Text } from "ink";
import { useState } from "react";
import { loadConfig } from "../config/file";
import type { Tools } from "../config/schema";
import { updateTools } from "../config/updaters";
import type { InstructionItem } from "../ui/key-instructions";
import { KeyInstructions } from "../ui/key-instructions";
import { Indent } from "../ui/layout/indent";
import type { ToggleListItem } from "../ui/toggle-list";
import { ToggleList } from "../ui/toggle-list";
import { theme } from "../ui/theme";

/** Tool keys matching the config schema. */
type ToolKey = keyof Tools;

/** Display order and labels for tools. */
const TOOL_ITEMS: readonly { key: ToolKey; label: string }[] = [
  { key: "agent", label: "Agent" },
  { key: "ask", label: "Ask" },
  { key: "editFile", label: "Edit File" },
  { key: "glob", label: "Glob" },
  { key: "grep", label: "Grep" },
  { key: "readFile", label: "Read File" },
  { key: "runCommand", label: "Run Command" },
  { key: "skill", label: "Skill" },
  { key: "webSearch", label: "Web Search" },
  { key: "writeFile", label: "Write File" },
];

/** Key instructions for the tools screen. */
const INSTRUCTIONS: InstructionItem[] = [
  { key: "up/down", description: "navigate" },
  { key: "space/enter", description: "toggle" },
  { key: "escape", description: "back" },
];

/** Returns the terminal width, defaulting to 80 if unavailable. */
function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}

/** Builds a full-width border line of ─ characters. */
function buildBorder(): string {
  return "─".repeat(getTerminalWidth());
}

/** Builds toggle list items from tools config. */
function buildToggleItems(tools: Tools): ToggleListItem[] {
  return TOOL_ITEMS.map((item) => ({
    key: item.key,
    label: item.label,
    value: tools[item.key].enabled,
  }));
}

/** Props for ToolsScreen. */
export interface ToolsScreenProps {
  onBack: () => void;
}

/** Manages tools state and persistence. */
function useToolsScreen(props: ToolsScreenProps) {
  const [tools, setTools] = useState<Tools>(() => {
    return loadConfig().tools;
  });

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

  return {
    items: buildToggleItems(tools),
    handleToggle,
    handleBack: props.onBack,
  };
}

/** Settings sub-screen for enabling and disabling tools. */
export function ToolsScreen(props: ToolsScreenProps) {
  const { items, handleToggle, handleBack } = useToolsScreen(props);

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Text color={theme.settings}>{buildBorder()}</Text>
      <Indent>
        <Text bold>Tools</Text>
      </Indent>
      <ToggleList
        items={items}
        onToggle={handleToggle}
        onExit={handleBack}
        color={theme.settings}
      />
      <Text color={theme.settings}>{buildBorder()}</Text>
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions items={INSTRUCTIONS} />
      </Box>
    </Box>
  );
}
