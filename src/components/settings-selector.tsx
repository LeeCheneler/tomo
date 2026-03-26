import { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import { CheckboxList, type CheckboxItem } from "./checkbox-list";

interface PermissionRow {
  key: string;
  displayName: string;
  description: string;
}

const PERMISSION_ROWS: PermissionRow[] = [
  {
    key: "read_file",
    displayName: "Read File",
    description: "Read files in current directory",
  },
  {
    key: "write_file",
    displayName: "Write File",
    description: "Write files in current directory",
  },
  {
    key: "edit_file",
    displayName: "Edit File",
    description: "Edit files in current directory",
  },
];

type Step = "menu" | "tools" | "permissions" | "allowed";

const MENU_OPTIONS = [
  "Tool Availability",
  "Tool Permissions",
  "Allowed Commands",
];

export interface SettingsSelectorProps {
  tools: string[];
  toolDisplayNames?: Record<string, string>;
  toolDescriptions?: Record<string, string>;
  currentToolAvailability: Record<string, boolean>;
  toolWarnings?: Record<string, string>;
  currentPermissions: Record<string, boolean>;
  currentAllowedCommands: string[];
  onSave: (
    toolAvailability: Record<string, boolean>,
    permissions: Record<string, boolean>,
    allowedCommands: string[],
  ) => void;
  onCancel: () => void;
}

/** Interactive multi-step settings UI for tools, permissions, and allowed commands. */
export function SettingsSelector({
  tools,
  toolDisplayNames,
  toolDescriptions,
  currentToolAvailability,
  toolWarnings,
  currentPermissions,
  currentAllowedCommands,
  onSave,
  onCancel,
}: SettingsSelectorProps) {
  const [step, setStep] = useState<Step>("menu");
  const [cursor, setCursor] = useState(0);
  const [toolAvailability, setToolAvailability] = useState({
    ...currentToolAvailability,
  });
  const [permissions, setPermissions] = useState({ ...currentPermissions });
  const [allowedCommands, setAllowedCommands] = useState<string[]>([
    ...currentAllowedCommands,
  ]);
  const [adding, setAdding] = useState(false);
  const [newEntry, setNewEntry] = useState("");

  // Reset cursor when step changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset cursor on step change
  useEffect(() => {
    setCursor(0);
  }, [step]);

  const save = () => {
    onSave(toolAvailability, permissions, allowedCommands);
  };

  useInput((input, key) => {
    // Text input mode for adding an entry
    if (adding) {
      if (key.escape) {
        setAdding(false);
        setNewEntry("");
        return;
      }
      if (key.return) {
        const trimmed = newEntry.trim();
        if (trimmed && !allowedCommands.includes(trimmed)) {
          setAllowedCommands((prev) => [...prev, trimmed]);
        }
        setAdding(false);
        setNewEntry("");
        return;
      }
      if (key.backspace || key.delete) {
        setNewEntry((prev) => prev.slice(0, -1));
        return;
      }
      if (input && !key.ctrl && !key.meta) {
        setNewEntry((prev) => prev + input);
      }
      return;
    }

    if (key.escape) {
      if (step === "menu") {
        save();
      } else {
        setStep("menu");
      }
      return;
    }

    if (input === "q" || input === "Q") {
      if (step === "menu") {
        onCancel();
      } else {
        setStep("menu");
      }
      return;
    }

    switch (step) {
      case "menu": {
        if (key.upArrow) {
          setCursor((c) => (c > 0 ? c - 1 : MENU_OPTIONS.length - 1));
        } else if (key.downArrow) {
          setCursor((c) => (c < MENU_OPTIONS.length - 1 ? c + 1 : 0));
        } else if (key.return) {
          const steps: Step[] = ["tools", "permissions", "allowed"];
          setStep(steps[cursor]);
        }
        break;
      }

      case "tools": {
        if (key.upArrow) {
          setCursor((c) => (c > 0 ? c - 1 : tools.length - 1));
        } else if (key.downArrow) {
          setCursor((c) => (c < tools.length - 1 ? c + 1 : 0));
        } else if (input === " " || key.return) {
          const name = tools[cursor];
          setToolAvailability((prev) => ({
            ...prev,
            [name]: !prev[name],
          }));
        }
        break;
      }

      case "permissions": {
        if (key.upArrow) {
          setCursor((c) => (c > 0 ? c - 1 : PERMISSION_ROWS.length - 1));
        } else if (key.downArrow) {
          setCursor((c) => (c < PERMISSION_ROWS.length - 1 ? c + 1 : 0));
        } else if (input === " " || key.return) {
          const row = PERMISSION_ROWS[cursor];
          setPermissions((prev) => ({
            ...prev,
            [row.key]: !prev[row.key],
          }));
        }
        break;
      }

      case "allowed": {
        // rows: allowed commands + add row
        const totalRows = allowedCommands.length + 1;
        const isOnAdd = cursor === allowedCommands.length;

        if (key.upArrow) {
          setCursor((c) => (c > 0 ? c - 1 : totalRows - 1));
        } else if (key.downArrow) {
          setCursor((c) => (c < totalRows - 1 ? c + 1 : 0));
        } else if ((input === "d" || input === "D") && !isOnAdd) {
          setAllowedCommands((prev) => prev.filter((_, i) => i !== cursor));
          if (cursor >= totalRows - 1) {
            setCursor((c) => Math.max(0, c - 1));
          }
        } else if (input === "a" || input === "A") {
          setCursor(allowedCommands.length);
          setAdding(true);
        } else if ((input === " " || key.return) && isOnAdd) {
          setAdding(true);
        }
        break;
      }
    }
  });

  switch (step) {
    case "menu":
      return (
        <Box flexDirection="column">
          <Text dimColor>
            {"  Settings (↑↓ navigate, Enter select, Esc save, q cancel):"}
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

    case "tools": {
      const items: CheckboxItem[] = tools.map((name) => ({
        key: name,
        label: toolDisplayNames?.[name] ?? name,
        description: toolDescriptions?.[name],
        checked: toolAvailability[name] ?? true,
        warning:
          (toolAvailability[name] ?? true) ? toolWarnings?.[name] : undefined,
      }));
      return (
        <Box flexDirection="column">
          <Text dimColor>
            {"  Tool Availability (Space/Enter toggle, Esc back):"}
          </Text>
          <Text>{""}</Text>
          <CheckboxList items={items} cursor={cursor} />
        </Box>
      );
    }

    case "permissions": {
      const items: CheckboxItem[] = PERMISSION_ROWS.map((perm) => ({
        key: perm.key,
        label: perm.displayName,
        description: perm.description,
        checked: permissions[perm.key] ?? false,
      }));
      return (
        <Box flexDirection="column">
          <Text dimColor>
            {"  Tool Permissions (Space/Enter toggle, Esc back):"}
          </Text>
          <Text>{""}</Text>
          <CheckboxList items={items} cursor={cursor} />
        </Box>
      );
    }

    case "allowed":
      return (
        <Box flexDirection="column">
          <Text dimColor>
            {"  Allowed Commands (d delete, a add, Esc back):"}
          </Text>
          <Text dimColor>
            {"  Use exact commands (npm test) or prefixes (git:*)"}
          </Text>
          <Text>{""}</Text>
          {allowedCommands.map((cmd, i) => {
            const isCurrent = i === cursor;
            return (
              <Text key={cmd} color={isCurrent ? "cyan" : undefined}>
                {"    "}
                {isCurrent ? "❯" : " "} {cmd}
              </Text>
            );
          })}
          {(() => {
            const isCurrent = cursor === allowedCommands.length;
            if (adding) {
              return (
                <Text color="green">
                  {"    ❯ [+] "}
                  {newEntry}
                  {"█"}
                </Text>
              );
            }
            return (
              <Text color={isCurrent ? "cyan" : "dim"}>
                {"    "}
                {isCurrent ? "❯" : " "} [+] Add...
              </Text>
            );
          })()}
        </Box>
      );
  }
}
