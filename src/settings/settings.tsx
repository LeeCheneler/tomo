import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type { TakeoverDone } from "../commands/registry";
import { Border } from "../ui/border";
import type { InstructionItem } from "../ui/key-instructions";
import { KeyInstructions } from "../ui/key-instructions";
import { Indent } from "../ui/layout/indent";
import type { NavigationMenuItem } from "../ui/navigation-menu";
import { NavigationMenu } from "../ui/navigation-menu";
import { theme } from "../ui/theme";
import { AllowedCommandsScreen } from "./allowed-commands";
import { PermissionsScreen } from "./permissions";
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
const MENU_ITEMS: readonly NavigationMenuItem[] = [
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
  function handleSelect(item: NavigationMenuItem) {
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
          { key: "up/down", description: "navigate" },
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

  if (step === "permissions") {
    return <PermissionsScreen onBack={handleBack} />;
  }

  if (step === "tools") {
    return <ToolsScreen onBack={handleBack} />;
  }

  if (step === "allowed-commands") {
    return <AllowedCommandsScreen onBack={handleBack} />;
  }

  if (step !== "menu") {
    return <SettingsPlaceholder section={step} onBack={handleBack} />;
  }

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Border color={theme.settings} />
      <Indent>
        <Text bold>Settings</Text>
      </Indent>
      <NavigationMenu
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

/** Props for the placeholder sub-screen. */
interface SettingsPlaceholderProps {
  section: SettingsSection;
  onBack: () => void;
}

/** Temporary placeholder for section sub-screens. */
function SettingsPlaceholder(props: SettingsPlaceholderProps) {
  useInput((_input, key) => {
    if (key.escape) {
      props.onBack();
    }
  });

  /* v8 ignore next -- section always matches a menu item */
  const label =
    MENU_ITEMS.find((m) => m.key === props.section)?.label ?? props.section;

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Border color={theme.settings} />
      <Indent>
        <Text bold>{label}</Text>
      </Indent>
      <Indent>
        <Text dimColor>Coming soon</Text>
      </Indent>
      <Border color={theme.settings} />
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions items={[{ key: "esc", description: "back" }]} />
      </Box>
    </Box>
  );
}
