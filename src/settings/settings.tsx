import { Box, Text } from "ink";
import { useState } from "react";
import type { TakeoverDone } from "../commands/registry";
import { Border } from "../ui/border";
import type { InstructionItem } from "../ui/key-instructions";
import { KeyInstructions } from "../ui/key-instructions";
import { Indent } from "../ui/layout/indent";
import type { SelectListItem } from "../ui/select-list";
import { SelectList } from "../ui/select-list";
import { theme } from "../ui/theme";
import { AllowedCommandsScreen } from "./allowed-commands";
import { McpServersScreen } from "./mcp-servers";
import { PermissionsScreen } from "./permissions";
import { ProvidersScreen } from "./providers";
import { SkillSetsScreen } from "./skill-sets";
import { ToolsScreen } from "./tools";

/** Settings section identifiers. */
export type SettingsSection =
  | "providers"
  | "permissions"
  | "allowed-commands"
  | "tools"
  | "mcp"
  | "skill-sets";

/** The menu items for the settings navigation. */
const MENU_ITEMS: readonly SelectListItem[] = [
  { key: "providers", label: "Providers" },
  { key: "permissions", label: "Permissions" },
  { key: "allowed-commands", label: "Allowed Commands" },
  { key: "tools", label: "Tools" },
  { key: "mcp", label: "MCP Servers" },
  { key: "skill-sets", label: "Skill Sets" },
];

/** Props for Settings. */
export interface SettingsProps {
  onDone: TakeoverDone;
}

/** Internal step state — menu or a specific section. */
type Step = "menu" | SettingsSection;

/** Manages settings step routing. */
function useSettings(props: SettingsProps) {
  const [step, setStep] = useState<Step>("menu");

  /** Enters a section sub-screen. */
  function handleSelect(item: SelectListItem) {
    setStep(item.key as SettingsSection);
  }

  /** Returns to the menu from a sub-screen. */
  function handleBack() {
    setStep("menu");
  }

  /** Exits settings. */
  function handleExit() {
    props.onDone("Settings updated");
  }

  const instructions: InstructionItem[] =
    step === "menu"
      ? [
          { key: "enter", description: "select" },
          { key: "esc", description: "exit" },
        ]
      : [{ key: "esc", description: "back" }];

  return { step, instructions, handleSelect, handleBack, handleExit };
}

/** Root settings component. Renders a navigation menu and section sub-screens. */
export function Settings(props: SettingsProps) {
  const { step, instructions, handleSelect, handleBack, handleExit } =
    useSettings(props);

  if (step === "providers") {
    return <ProvidersScreen onBack={handleBack} />;
  }

  if (step === "permissions") {
    return <PermissionsScreen onBack={handleBack} />;
  }

  if (step === "tools") {
    return <ToolsScreen onBack={handleBack} />;
  }

  if (step === "allowed-commands") {
    return <AllowedCommandsScreen onBack={handleBack} />;
  }

  if (step === "skill-sets") {
    return <SkillSetsScreen onBack={handleBack} />;
  }

  if (step === "mcp") {
    return <McpServersScreen onBack={handleBack} />;
  }

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Border color={theme.settings} />
      <Indent>
        <Text bold>Settings</Text>
      </Indent>
      <SelectList
        items={MENU_ITEMS}
        onSelect={handleSelect}
        onExit={handleExit}
        color={theme.settings}
      />
      <Border color={theme.settings} />
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions items={instructions} />
      </Box>
    </Box>
  );
}
