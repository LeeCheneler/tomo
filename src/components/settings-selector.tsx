import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import type { McpServerConfig } from "../config";
import { useListNavigation } from "../hooks/use-list-navigation";
import { McpClient } from "../mcp/client";
import { HttpTransport } from "../mcp/http-transport";
import { decodeToolName, encodeToolName } from "../mcp/manager";
import { StdioTransport } from "../mcp/stdio-transport";
import { type CheckboxItem, CheckboxList } from "./checkbox-list";

interface PermissionRow {
  key: string;
  displayName: string;
  description: string;
}

const PERMISSION_ROWS: PermissionRow[] = [
  {
    key: "read_file",
    displayName: "Read File",
    description: "Read files in current directory (Tomo only)",
  },
  {
    key: "write_file",
    displayName: "Write File",
    description: "Write and edit files in current directory (Tomo only)",
  },
];

type Step =
  | "menu"
  | "tools"
  | "permissions"
  | "allowed"
  | "mcpServers"
  | "mcpAddType"
  | "mcpAddUrl"
  | "mcpAddCommand"
  | "mcpConnecting";

const MENU_OPTIONS = [
  "Tool Availability",
  "Tool Permissions",
  "Allowed Commands",
  "MCP Servers",
];

const MCP_TRANSPORT_TYPES = ["http", "stdio"] as const;

export interface SettingsSelectorProps {
  tools: string[];
  toolDisplayNames?: Record<string, string>;
  toolDescriptions?: Record<string, string>;
  currentToolAvailability: Record<string, boolean>;
  toolWarnings?: Record<string, string>;
  currentPermissions: Record<string, boolean>;
  currentAllowedCommands: string[];
  mcpServers: Record<string, McpServerConfig>;
  mcpFailedServers?: Set<string>;
  onSave: (
    toolAvailability: Record<string, boolean>,
    permissions: Record<string, boolean>,
    allowedCommands: string[],
  ) => void;
  onAddMcpServer: (
    name: string,
    server: McpServerConfig,
    toolNames: string[],
  ) => void;
  onRemoveMcpServer: (name: string) => void;
  onToggleMcpServer: (name: string, enabled: boolean) => void;
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
  mcpServers,
  mcpFailedServers,
  onSave,
  onAddMcpServer,
  onRemoveMcpServer,
  onToggleMcpServer,
  onCancel,
}: SettingsSelectorProps) {
  const [step, setStep] = useState<Step>("menu");
  const [toolAvailability, setToolAvailability] = useState({
    ...currentToolAvailability,
  });
  const [permissions, setPermissions] = useState({ ...currentPermissions });
  const [allowedCommands, setAllowedCommands] = useState<string[]>([
    ...currentAllowedCommands,
  ]);
  const [adding, setAdding] = useState(false);
  const [newEntry, setNewEntry] = useState("");

  // Derive full tool list: static props + any MCP tools added during this session
  const allToolNames = [
    ...tools,
    ...Object.keys(toolAvailability).filter(
      (name) => name.startsWith("mcp__") && !tools.includes(name),
    ),
  ];

  // MCP server state
  const [mcpServerList, setMcpServerList] = useState(mcpServers);
  const mcpServerNames = Object.keys(mcpServerList);
  const [mcpFailed, setMcpFailed] = useState<Set<string>>(
    mcpFailedServers ?? new Set(),
  );
  const [mcpTextValue, setMcpTextValue] = useState("");
  const [mcpConnectError, setMcpConnectError] = useState<string | null>(null);
  const [mcpPendingConfig, setMcpPendingConfig] =
    useState<McpServerConfig | null>(null);
  const [mcpReconnectName, setMcpReconnectName] = useState<string | null>(null);

  // Compute item count based on current step
  const itemCount = (() => {
    switch (step) {
      case "menu":
        return MENU_OPTIONS.length;
      case "tools":
        return allToolNames.length;
      case "permissions":
        return PERMISSION_ROWS.length;
      case "allowed":
        return allowedCommands.length + 1; // +1 for "Add..." row
      case "mcpServers":
        return mcpServerNames.length + 1; // +1 for "Add..." row
      case "mcpAddType":
        return MCP_TRANSPORT_TYPES.length;
      default:
        return 0;
    }
  })();

  const { cursor, setCursor, handleUp, handleDown } =
    useListNavigation(itemCount);

  // Reset cursor when step changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally reset cursor on step change
  useEffect(() => {
    setCursor(0);
  }, [step]);

  // Connect to MCP server, discover name + tools, save config
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally only trigger on step/config changes
  useEffect(() => {
    if (step !== "mcpConnecting" || !mcpPendingConfig) return;
    let cancelled = false;

    (async () => {
      let client: McpClient | null = null;
      try {
        const transport =
          mcpPendingConfig.transport === "stdio"
            ? new StdioTransport(
                (mcpPendingConfig as { command: string }).command,
                (mcpPendingConfig as { args: string[] }).args,
                (mcpPendingConfig as { env?: Record<string, string> }).env,
              )
            : new HttpTransport(
                (mcpPendingConfig as { url: string }).url,
                (mcpPendingConfig as { headers?: Record<string, string> })
                  .headers,
              );

        client = new McpClient(transport);
        const initResult = await client.initialize();
        const tools = await client.listTools();
        client.close();
        client = null;

        if (cancelled) return;

        if (mcpReconnectName) {
          // Reconnect: clear the failure, don't re-add
          setMcpFailed((prev) => {
            const next = new Set(prev);
            next.delete(mcpReconnectName);
            return next;
          });
          setMcpReconnectName(null);
        } else {
          // New server: use server-provided name, dedup if needed
          let serverName = initResult.serverInfo.name;
          if (mcpServerList[serverName]) {
            let suffix = 2;
            while (mcpServerList[`${serverName}-${suffix}`]) {
              suffix++;
            }
            serverName = `${serverName}-${suffix}`;
          }

          // Disable all discovered tools by default
          const toolNames = tools.map((t) =>
            encodeToolName(serverName, t.name),
          );

          onAddMcpServer(serverName, mcpPendingConfig, toolNames);
          setMcpServerList((prev) => ({
            ...prev,
            [serverName]: mcpPendingConfig,
          }));
          // Mark tools as disabled in local tool availability
          setToolAvailability((prev) => {
            const updated = { ...prev };
            for (const name of toolNames) {
              updated[name] = false;
            }
            return updated;
          });
        }
        setMcpTextValue("");
        setMcpPendingConfig(null);
        setStep("mcpServers");
      } catch (err) {
        client?.close();
        if (cancelled) return;
        setMcpConnectError(
          err instanceof Error ? err.message : "Connection failed",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [step, mcpPendingConfig]);

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

    const mcpSubSteps: Step[] = [
      "mcpAddType",
      "mcpAddUrl",
      "mcpAddCommand",
      "mcpConnecting",
    ];

    if (key.escape) {
      if (step === "menu") {
        save();
      } else if (mcpSubSteps.includes(step)) {
        setMcpTextValue("");
        setMcpConnectError(null);
        setMcpPendingConfig(null);
        setMcpReconnectName(null);
        setStep("mcpServers");
      } else {
        setStep("menu");
      }
      return;
    }

    if (input === "q" || input === "Q") {
      if (step === "menu") {
        onCancel();
      } else if (mcpSubSteps.includes(step)) {
        setMcpTextValue("");
        setMcpConnectError(null);
        setMcpPendingConfig(null);
        setMcpReconnectName(null);
        setStep("mcpServers");
      } else {
        setStep("menu");
      }
      return;
    }

    switch (step) {
      case "menu": {
        if (key.upArrow) {
          handleUp();
        } else if (key.downArrow) {
          handleDown();
        } else if (key.return) {
          const steps: Step[] = [
            "tools",
            "permissions",
            "allowed",
            "mcpServers",
          ];
          setStep(steps[cursor]);
        }
        break;
      }

      case "tools": {
        if (key.upArrow) {
          handleUp();
        } else if (key.downArrow) {
          handleDown();
        } else if (input === " " || key.return) {
          const name = allToolNames[cursor];
          setToolAvailability((prev) => ({
            ...prev,
            [name]: !prev[name],
          }));
        }
        break;
      }

      case "permissions": {
        if (key.upArrow) {
          handleUp();
        } else if (key.downArrow) {
          handleDown();
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
        const isOnAdd = cursor === allowedCommands.length;

        if (key.upArrow) {
          handleUp();
        } else if (key.downArrow) {
          handleDown();
        } else if ((input === "d" || input === "D") && !isOnAdd) {
          setAllowedCommands((prev) => prev.filter((_, i) => i !== cursor));
          if (cursor >= itemCount - 1) {
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

      case "mcpServers": {
        const isOnAdd = cursor === mcpServerNames.length;

        if (key.upArrow) {
          handleUp();
        } else if (key.downArrow) {
          handleDown();
        } else if ((input === " " || key.return) && !isOnAdd) {
          const name = mcpServerNames[cursor];
          const server = mcpServerList[name];
          const currentEnabled = server.enabled !== false;
          onToggleMcpServer(name, !currentEnabled);
          setMcpServerList((prev) => ({
            ...prev,
            [name]: { ...prev[name], enabled: !currentEnabled },
          }));
        } else if ((input === "d" || input === "D") && !isOnAdd) {
          const name = mcpServerNames[cursor];
          const toolPrefix = `mcp__${name}__`;
          onRemoveMcpServer(name);
          setMcpServerList((prev) => {
            const next = { ...prev };
            delete next[name];
            return next;
          });
          setToolAvailability((prev) => {
            const next = { ...prev };
            for (const key of Object.keys(next)) {
              if (key.startsWith(toolPrefix)) {
                delete next[key];
              }
            }
            return next;
          });
          if (cursor >= mcpServerNames.length - 1) {
            setCursor((c) => Math.max(0, c - 1));
          }
        } else if (
          (input === "r" || input === "R") &&
          !isOnAdd &&
          mcpFailed.has(mcpServerNames[cursor])
        ) {
          const name = mcpServerNames[cursor];
          const server = mcpServerList[name];
          setMcpReconnectName(name);
          setMcpPendingConfig(server);
          setMcpConnectError(null);
          setStep("mcpConnecting");
        } else if (
          input === "a" ||
          input === "A" ||
          ((input === " " || key.return) && isOnAdd)
        ) {
          setMcpTextValue("");
          setMcpConnectError(null);
          setStep("mcpAddType");
        }
        break;
      }

      case "mcpAddType": {
        if (key.upArrow) {
          handleUp();
        } else if (key.downArrow) {
          handleDown();
        } else if (key.return) {
          const type = MCP_TRANSPORT_TYPES[cursor];
          setMcpTextValue(type === "http" ? "https://" : "");
          setStep(type === "http" ? "mcpAddUrl" : "mcpAddCommand");
        }
        break;
      }

      case "mcpAddUrl": {
        if (key.return) {
          const url = mcpTextValue.trim();
          if (!url) return;
          setMcpPendingConfig({ transport: "http", url });
          setMcpConnectError(null);
          setStep("mcpConnecting");
        } else if (key.backspace || key.delete) {
          setMcpTextValue((v) => v.slice(0, -1));
        } else if (input && !key.ctrl && !key.meta) {
          setMcpTextValue((v) => v + input);
        }
        break;
      }

      case "mcpAddCommand": {
        if (key.return) {
          const parts = mcpTextValue.trim().split(/\s+/);
          const command = parts[0];
          if (!command) return;
          const args = parts.slice(1);
          setMcpPendingConfig({ transport: "stdio", command, args });
          setMcpConnectError(null);
          setStep("mcpConnecting");
        } else if (key.backspace || key.delete) {
          setMcpTextValue((v) => v.slice(0, -1));
        } else if (input && !key.ctrl && !key.meta) {
          setMcpTextValue((v) => v + input);
        }
        break;
      }

      case "mcpConnecting": {
        // No input during connect
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
      const items: CheckboxItem[] = allToolNames.map((name) => {
        let label = toolDisplayNames?.[name];
        if (!label) {
          const decoded = decodeToolName(name);
          label = decoded
            ? `MCP → ${decoded.serverName} → ${decoded.toolName}`
            : name;
        }
        return {
          key: name,
          label,
          description: toolDescriptions?.[name],
          checked: toolAvailability[name] ?? true,
          warning:
            (toolAvailability[name] ?? true) ? toolWarnings?.[name] : undefined,
        };
      });
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

    case "mcpServers": {
      const mcpItems: CheckboxItem[] = mcpServerNames.map((name) => {
        const server = mcpServerList[name];
        const transport =
          server.transport === "http"
            ? (server as { url: string }).url
            : (server as { command: string }).command;
        const failed = mcpFailed.has(name);
        return {
          key: name,
          label: name,
          description: `${server.transport} — ${transport}`,
          checked: server.enabled !== false,
          warning:
            failed && server.enabled !== false
              ? "Failed to connect"
              : undefined,
        };
      });
      return (
        <Box flexDirection="column">
          <Text dimColor>
            {
              "  MCP Servers (Space/Enter toggle, d delete, a add, r reconnect, Esc back):"
            }
          </Text>
          <Text>{""}</Text>
          <CheckboxList items={mcpItems} cursor={cursor} />
          {(() => {
            const isCurrent = cursor === mcpServerNames.length;
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

    case "mcpAddType":
      return (
        <Box flexDirection="column">
          <Text dimColor>
            {"  Select transport type (↑↓ navigate, Enter select, Esc back):"}
          </Text>
          <Text>{""}</Text>
          {MCP_TRANSPORT_TYPES.map((type, i) => {
            const isCurrent = i === cursor;
            return (
              <Text key={type} color={isCurrent ? "cyan" : undefined}>
                {"    "}
                {isCurrent ? "❯" : " "} {type}
              </Text>
            );
          })}
        </Box>
      );

    case "mcpAddUrl":
      return (
        <Box flexDirection="column">
          <Text dimColor>
            {"  Enter server URL (Enter confirm, Esc back):"}
          </Text>
          <Text>{""}</Text>
          <Text>
            {"    "}
            {mcpTextValue}
            <Text dimColor>█</Text>
          </Text>
        </Box>
      );

    case "mcpAddCommand":
      return (
        <Box flexDirection="column">
          <Text dimColor>
            {
              "  Enter command and args to start the server (Enter confirm, Esc back):"
            }
          </Text>
          <Text>{""}</Text>
          <Text>
            {"    "}
            {mcpTextValue}
            <Text dimColor>█</Text>
          </Text>
        </Box>
      );

    case "mcpConnecting":
      if (mcpConnectError) {
        return (
          <Box flexDirection="column">
            <Text color="red">
              {"  Failed to connect: "}
              {mcpConnectError}
            </Text>
            <Text dimColor>{"  Press Esc to go back."}</Text>
          </Box>
        );
      }
      return <Text dimColor>{"  Connecting to MCP server..."}</Text>;
  }
}
