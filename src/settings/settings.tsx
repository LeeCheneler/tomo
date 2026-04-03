import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type { TakeoverDone } from "../commands/registry";
import type { InstructionItem } from "../ui/key-instructions";
import { KeyInstructions } from "../ui/key-instructions";
import { Indent } from "../ui/layout/indent";
import { theme } from "../ui/theme";

/** Settings section identifiers. */
export type SettingsSection =
  | "providers"
  | "permissions"
  | "allowed-commands"
  | "tools"
  | "mcp"
  | "skill-sets";

/** A menu item in the settings navigation. */
interface MenuItem {
  label: string;
  section: SettingsSection;
}

/** The menu items for the settings navigation. */
const MENU_ITEMS: readonly MenuItem[] = [
  { label: "Providers", section: "providers" },
  { label: "Permissions", section: "permissions" },
  { label: "Allowed Commands", section: "allowed-commands" },
  { label: "Tools", section: "tools" },
  { label: "MCP Servers", section: "mcp" },
  { label: "Skill Sets", section: "skill-sets" },
];

/** Returns the terminal width, defaulting to 80 if unavailable. */
function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}

/** Builds a full-width border line of ─ characters. */
function buildBorder(): string {
  return "─".repeat(getTerminalWidth());
}

/** Props for Settings. */
export interface SettingsProps {
  onDone: TakeoverDone;
}

/** Internal step state — menu or a specific section. */
type Step = "menu" | SettingsSection;

/** Manages settings menu navigation and step routing. */
function useSettings(props: SettingsProps) {
  const [step, setStep] = useState<Step>("menu");
  const [cursor, setCursor] = useState(0);

  useInput((_input, key) => {
    if (step !== "menu") return;

    if (key.escape) {
      props.onDone();
      return;
    }

    if (key.upArrow) {
      setCursor((i) => Math.max(0, i - 1));
      return;
    }

    if (key.downArrow) {
      setCursor((i) => Math.min(MENU_ITEMS.length - 1, i + 1));
      return;
    }

    if (key.return) {
      setStep(MENU_ITEMS[cursor].section);
      return;
    }
  });

  /** Returns to the menu from a sub-screen. */
  function handleBack() {
    setStep("menu");
    setCursor(0);
  }

  const instructions: InstructionItem[] =
    step === "menu"
      ? [
          { key: "up/down", description: "navigate" },
          { key: "enter", description: "select" },
          { key: "escape", description: "exit" },
        ]
      : [{ key: "escape", description: "back" }];

  return { step, cursor, instructions, handleBack };
}

/** Root settings component. Renders a navigation menu and section sub-screens. */
export function Settings(props: SettingsProps) {
  const { step, cursor, instructions, handleBack } = useSettings(props);

  if (step !== "menu") {
    return <SettingsPlaceholder section={step} onBack={handleBack} />;
  }

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Text color={theme.settings}>{buildBorder()}</Text>
      <Indent>
        <Text bold>Settings</Text>
      </Indent>
      {MENU_ITEMS.map((item, i) => {
        const isSelected = i === cursor;
        return (
          <Indent key={item.section}>
            <Text color={isSelected ? theme.settings : undefined}>
              {isSelected ? "❯" : " "} {item.label}
            </Text>
          </Indent>
        );
      })}
      <Text color={theme.settings}>{buildBorder()}</Text>
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
    MENU_ITEMS.find((m) => m.section === props.section)?.label ?? props.section;

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Text color={theme.settings}>{buildBorder()}</Text>
      <Indent>
        <Text bold>{label}</Text>
      </Indent>
      <Indent>
        <Text dimColor>Coming soon</Text>
      </Indent>
      <Text color={theme.settings}>{buildBorder()}</Text>
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions items={[{ key: "escape", description: "back" }]} />
      </Box>
    </Box>
  );
}
