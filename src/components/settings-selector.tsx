import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import type { McpServerConfig } from "../config";
import { useListNavigation } from "../hooks/use-list-navigation";
import { AllowedCommandsEditor } from "./allowed-commands-editor";
import { McpServerSelector } from "./mcp-server-selector";
import { ToolAvailabilityEditor } from "./tool-availability-editor";
import { ToolPermissionsEditor } from "./tool-permissions-editor";

/** The full settings state owned by the root component. */
export interface SettingsState {
  toolAvailability: Record<string, boolean>;
  permissions: Record<string, boolean>;
  allowedCommands: string[];
  mcpServers: Record<string, McpServerConfig>;
}

/** Static tool metadata that doesn't change during the settings session. */
export interface ToolMeta {
  names: string[];
  displayNames: Record<string, string>;
  descriptions: Record<string, string>;
  warnings: Record<string, string>;
}

type Step = "menu" | "tools" | "permissions" | "allowed" | "mcpServers";

const MENU_OPTIONS = [
  "Tool Availability",
  "Tool Permissions",
  "Allowed Commands",
  "MCP Servers",
];

const MENU_STEPS: Step[] = ["tools", "permissions", "allowed", "mcpServers"];

export interface SettingsSelectorProps {
  initialState: SettingsState;
  toolMeta: ToolMeta;
  mcpFailedServers?: Set<string>;
  onSave: (state: SettingsState) => void;
}

/** Settings root. Owns a single config state; sub-components read/update it; saves on final Esc. */
export function SettingsSelector({
  initialState,
  toolMeta,
  mcpFailedServers,
  onSave,
}: SettingsSelectorProps) {
  const [state, setState] = useState<SettingsState>({ ...initialState });
  const [step, setStep] = useState<Step>("menu");

  const update = (partial: Partial<SettingsState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  };

  const { cursor, setCursor, handleUp, handleDown } = useListNavigation(
    MENU_OPTIONS.length,
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset cursor on step change
  useEffect(() => {
    setCursor(0);
  }, [step]);

  useInput((_input, key) => {
    if (step !== "menu") return;

    if (key.escape) {
      onSave(state);
      return;
    }

    if (key.upArrow) {
      handleUp();
    } else if (key.downArrow) {
      handleDown();
    } else if (key.return) {
      setStep(MENU_STEPS[cursor]);
    }
  });

  const goBack = () => setStep("menu");

  switch (step) {
    case "menu":
      return (
        <Box flexDirection="column">
          <Text dimColor>
            {"  Settings (↑↓ navigate, Enter select, Esc save):"}
          </Text>
          <Text>{""}</Text>
          {MENU_OPTIONS.map((option, i) => {
            const isCurrent = i === cursor;
            return (
              <Text key={option} color={isCurrent ? "cyan" : undefined}>
                {"    "}
                {isCurrent ? "❯" : " "} {option}
              </Text>
            );
          })}
        </Box>
      );

    case "tools":
      return (
        <ToolAvailabilityEditor
          state={state}
          toolMeta={toolMeta}
          onUpdate={update}
          onBack={goBack}
        />
      );

    case "permissions":
      return (
        <ToolPermissionsEditor
          state={state}
          onUpdate={update}
          onBack={goBack}
        />
      );

    case "allowed":
      return (
        <AllowedCommandsEditor
          state={state}
          onUpdate={update}
          onBack={goBack}
        />
      );

    case "mcpServers":
      return (
        <McpServerSelector
          state={state}
          onUpdate={update}
          failedServers={mcpFailedServers}
          onBack={goBack}
        />
      );
  }
}
