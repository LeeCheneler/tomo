import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import type { McpServerConfig } from "../config";
import { useListNavigation } from "../hooks/use-list-navigation";
import { McpClient } from "../mcp/client";
import { HttpTransport } from "../mcp/http-transport";
import { StdioTransport } from "../mcp/stdio-transport";
import { type CheckboxItem, CheckboxList } from "./checkbox-list";
import type { SettingsState } from "./settings-selector";

type Step =
  | "servers"
  | "serverTools"
  | "addType"
  | "addUrl"
  | "addHeaders"
  | "addHeaderKey"
  | "addHeaderValue"
  | "addCommand"
  | "connecting";

const TRANSPORT_TYPES = ["http", "stdio"] as const;

export interface McpServerSelectorProps {
  state: SettingsState;
  onUpdate: (partial: Partial<SettingsState>) => void;
  failedServers?: Set<string>;
  onBack: () => void;
}

/** Dedicated MCP server management UI with per-server tool toggles. */
export function McpServerSelector({
  state,
  onUpdate,
  failedServers,
  onBack,
}: McpServerSelectorProps) {
  const [step, setStep] = useState<Step>("servers");
  const serverNames = Object.keys(state.mcpServers);
  const [failed, setFailed] = useState<Set<string>>(failedServers ?? new Set());
  const [textValue, setTextValue] = useState("");
  const [connectError, setConnectError] = useState<string | null>(null);
  const [pendingConfig, setPendingConfig] = useState<McpServerConfig | null>(
    null,
  );
  const [reconnectName, setReconnectName] = useState<string | null>(null);
  const [activeServer, setActiveServer] = useState<string | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [pendingHeaders, setPendingHeaders] = useState<Record<string, string>>(
    {},
  );
  const [pendingHeaderKey, setPendingHeaderKey] = useState<string | null>(null);
  const [editingServerName, setEditingServerName] = useState<string | null>(
    null,
  );

  const activeTools = activeServer
    ? (state.mcpServers[activeServer]?.tools ?? [])
    : [];

  const headerKeys = Object.keys(pendingHeaders);

  const itemCount = (() => {
    switch (step) {
      case "servers":
        return serverNames.length + 1;
      case "serverTools":
        return activeTools.length;
      case "addType":
        return TRANSPORT_TYPES.length;
      case "addHeaders":
        return headerKeys.length;
      default:
        return 0;
    }
  })();

  const { cursor, setCursor, handleUp, handleDown } =
    useListNavigation(itemCount);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset cursor on step change
  useEffect(() => {
    setCursor(0);
  }, [step]);

  // Connect to MCP server, discover name + tools
  // biome-ignore lint/correctness/useExhaustiveDependencies: only trigger on step/config changes
  useEffect(() => {
    if (step !== "connecting" || !pendingConfig) return;
    let cancelled = false;

    (async () => {
      let client: McpClient | null = null;
      try {
        const transport =
          pendingConfig.transport === "stdio"
            ? new StdioTransport(
                (pendingConfig as { command: string }).command,
                (pendingConfig as { args: string[] }).args,
                (pendingConfig as { env?: Record<string, string> }).env,
              )
            : new HttpTransport(
                (pendingConfig as { url: string }).url,
                (pendingConfig as { headers?: Record<string, string> }).headers,
              );

        client = new McpClient(transport);
        const initResult = await client.initialize();
        const tools = await client.listTools();
        client.close();
        client = null;

        if (cancelled) return;

        if (reconnectName) {
          setFailed((prev) => {
            const next = new Set(prev);
            next.delete(reconnectName);
            return next;
          });
          setReconnectName(null);
        } else {
          let serverName = initResult.serverInfo.name;
          if (state.mcpServers[serverName]) {
            let suffix = 2;
            while (state.mcpServers[`${serverName}-${suffix}`]) {
              suffix++;
            }
            serverName = `${serverName}-${suffix}`;
          }

          const serverWithTools: McpServerConfig = {
            ...pendingConfig,
            tools: tools.map((t) => ({
              name: t.name,
              enabled: true,
              description: t.description,
            })),
          };

          onUpdate({
            mcpServers: {
              ...state.mcpServers,
              [serverName]: serverWithTools,
            },
          });
        }
        setTextValue("");
        setPendingConfig(null);
        setStep("servers");
      } catch (err) {
        client?.close();
        if (cancelled) return;
        setConnectError(
          err instanceof Error ? err.message : "Connection failed",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [step, pendingConfig]);

  const subSteps: Step[] = [
    "addType",
    "addUrl",
    "addHeaders",
    "addHeaderKey",
    "addHeaderValue",
    "addCommand",
    "connecting",
  ];

  useInput((input, key) => {
    if (key.escape) {
      if (step === "servers") {
        onBack();
      } else if (step === "serverTools") {
        setActiveServer(null);
        setStep("servers");
      } else if (subSteps.includes(step)) {
        setTextValue("");
        setConnectError(null);
        setPendingConfig(null);
        setPendingUrl(null);
        setPendingHeaders({});
        setPendingHeaderKey(null);
        setEditingServerName(null);
        setReconnectName(null);
        setStep("servers");
      }
      return;
    }

    switch (step) {
      case "servers": {
        const isOnAdd = cursor === serverNames.length;

        if (key.upArrow) {
          handleUp();
        } else if (key.downArrow) {
          handleDown();
        } else if (input === " " && !isOnAdd) {
          const name = serverNames[cursor];
          const server = state.mcpServers[name];
          const currentEnabled = server.enabled !== false;
          onUpdate({
            mcpServers: {
              ...state.mcpServers,
              [name]: { ...server, enabled: !currentEnabled },
            },
          });
        } else if (key.return && !isOnAdd) {
          setActiveServer(serverNames[cursor]);
          setStep("serverTools");
        } else if ((input === "d" || input === "D") && !isOnAdd) {
          const name = serverNames[cursor];
          const { [name]: _, ...rest } = state.mcpServers;
          onUpdate({ mcpServers: rest });
          if (cursor >= serverNames.length - 1) {
            setCursor((c) => Math.max(0, c - 1));
          }
        } else if (
          (input === "r" || input === "R") &&
          !isOnAdd &&
          failed.has(serverNames[cursor])
        ) {
          const name = serverNames[cursor];
          setReconnectName(name);
          setPendingConfig(state.mcpServers[name]);
          setConnectError(null);
          setStep("connecting");
        } else if ((input === "e" || input === "E") && !isOnAdd) {
          const name = serverNames[cursor];
          const server = state.mcpServers[name];
          const currentHeaders =
            server.transport === "http"
              ? ((server as { headers?: Record<string, string> }).headers ?? {})
              : {};
          setEditingServerName(name);
          setPendingHeaders({ ...currentHeaders });
          setStep("addHeaders");
        } else if (input === "a" || input === "A") {
          setTextValue("");
          setConnectError(null);
          setStep("addType");
        }
        break;
      }

      case "serverTools": {
        if (key.upArrow) {
          handleUp();
        } else if (key.downArrow) {
          handleDown();
        } else if (input === " " && activeServer) {
          const tool = activeTools[cursor];
          if (!tool) break;
          const updated = activeTools.map((t) =>
            t.name === tool.name ? { ...t, enabled: !t.enabled } : t,
          );
          onUpdate({
            mcpServers: {
              ...state.mcpServers,
              [activeServer]: {
                ...state.mcpServers[activeServer],
                tools: updated,
              },
            },
          });
        }
        break;
      }

      case "addType": {
        if (key.upArrow) {
          handleUp();
        } else if (key.downArrow) {
          handleDown();
        } else if (key.return) {
          const type = TRANSPORT_TYPES[cursor];
          setTextValue(type === "http" ? "https://" : "");
          setStep(type === "http" ? "addUrl" : "addCommand");
        }
        break;
      }

      case "addUrl": {
        if (key.return) {
          const url = textValue.trim();
          if (!url) return;
          setPendingUrl(url);
          setTextValue("");
          setPendingHeaders({});
          setStep("addHeaders");
        } else if (key.backspace || key.delete) {
          setTextValue((v) => v.slice(0, -1));
        } else if (input && !key.ctrl && !key.meta) {
          setTextValue((v) => v + input);
        }
        break;
      }

      case "addHeaders": {
        if (key.upArrow) {
          handleUp();
        } else if (key.downArrow) {
          handleDown();
        } else if (key.return) {
          if (editingServerName) {
            // Editing headers on an existing server — update config directly.
            // Destructure to strip old headers, then only add back if non-empty.
            const { headers: _oldHeaders, ...serverWithoutHeaders } = state
              .mcpServers[editingServerName] as McpServerConfig & {
              headers?: Record<string, string>;
            };
            const headers =
              headerKeys.length > 0 ? { ...pendingHeaders } : undefined;
            onUpdate({
              mcpServers: {
                ...state.mcpServers,
                [editingServerName]: {
                  ...serverWithoutHeaders,
                  ...(headers ? { headers } : {}),
                },
              },
            });
            setEditingServerName(null);
            setPendingHeaders({});
            setStep("servers");
          } else {
            // Add flow — proceed to connecting
            const headers =
              headerKeys.length > 0 ? { ...pendingHeaders } : undefined;
            setPendingConfig({
              transport: "http",
              url: pendingUrl ?? "",
              ...(headers ? { headers } : {}),
            });
            setConnectError(null);
            setPendingUrl(null);
            setPendingHeaders({});
            setStep("connecting");
          }
        } else if (input === "a" || input === "A") {
          setTextValue("");
          setStep("addHeaderKey");
        } else if ((input === "e" || input === "E") && headerKeys.length > 0) {
          const keyToEdit = headerKeys[cursor];
          setPendingHeaderKey(keyToEdit);
          setTextValue(pendingHeaders[keyToEdit]);
          setStep("addHeaderValue");
        } else if ((input === "d" || input === "D") && headerKeys.length > 0) {
          const keyToRemove = headerKeys[cursor];
          const { [keyToRemove]: _, ...rest } = pendingHeaders;
          setPendingHeaders(rest);
          if (cursor >= headerKeys.length - 1) {
            setCursor((c) => Math.max(0, c - 1));
          }
        }
        break;
      }

      case "addHeaderKey": {
        if (key.return) {
          const headerKey = textValue.trim();
          if (!headerKey) return;
          setPendingHeaderKey(headerKey);
          setTextValue("");
          setStep("addHeaderValue");
        } else if (key.backspace || key.delete) {
          setTextValue((v) => v.slice(0, -1));
        } else if (input && !key.ctrl && !key.meta) {
          setTextValue((v) => v + input);
        }
        break;
      }

      case "addHeaderValue": {
        if (key.return) {
          const headerValue = textValue.trim();
          if (!headerValue) return;
          setPendingHeaders((prev) => ({
            ...prev,
            [pendingHeaderKey!]: headerValue,
          }));
          setPendingHeaderKey(null);
          setTextValue("");
          setStep("addHeaders");
        } else if (key.backspace || key.delete) {
          setTextValue((v) => v.slice(0, -1));
        } else if (input && !key.ctrl && !key.meta) {
          setTextValue((v) => v + input);
        }
        break;
      }

      case "addCommand": {
        if (key.return) {
          const parts = textValue.trim().split(/\s+/);
          const command = parts[0];
          if (!command) return;
          const args = parts.slice(1);
          setPendingConfig({ transport: "stdio", command, args });
          setConnectError(null);
          setStep("connecting");
        } else if (key.backspace || key.delete) {
          setTextValue((v) => v.slice(0, -1));
        } else if (input && !key.ctrl && !key.meta) {
          setTextValue((v) => v + input);
        }
        break;
      }

      case "connecting":
        break;
    }
  });

  switch (step) {
    case "servers": {
      const items: CheckboxItem[] = serverNames.map((name) => {
        const server = state.mcpServers[name];
        const transport =
          server.transport === "http"
            ? (server as { url: string }).url
            : (server as { command: string }).command;
        const isFailed = failed.has(name);
        return {
          key: name,
          label: name,
          description: `${server.transport} — ${transport}`,
          checked: server.enabled !== false,
          warning:
            isFailed && server.enabled !== false
              ? "Failed to connect"
              : undefined,
        };
      });
      return (
        <Box flexDirection="column">
          <Text dimColor>
            {
              "  MCP Servers (Space toggle, Enter tools, a add, e headers, d delete, r reconnect, Esc back):"
            }
          </Text>
          <Text>{""}</Text>
          <CheckboxList items={items} cursor={cursor} />
          {(() => {
            const isCurrent = cursor === serverNames.length;
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

    case "serverTools": {
      const items: CheckboxItem[] = activeTools.map((tool) => ({
        key: tool.name,
        label: tool.name,
        description: tool.description,
        checked: tool.enabled,
      }));
      return (
        <Box flexDirection="column">
          <Text dimColor>
            {`  ${activeServer} — Tools (Space toggle, Esc back):`}
          </Text>
          <Text>{""}</Text>
          {items.length === 0 ? (
            <Text dimColor>{"    No tools discovered."}</Text>
          ) : (
            <CheckboxList items={items} cursor={cursor} />
          )}
        </Box>
      );
    }

    case "addType":
      return (
        <Box flexDirection="column">
          <Text dimColor>
            {"  Select transport type (↑↓ navigate, Enter select, Esc back):"}
          </Text>
          <Text>{""}</Text>
          {TRANSPORT_TYPES.map((type, i) => {
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

    case "addUrl":
      return (
        <Box flexDirection="column">
          <Text dimColor>
            {"  Enter server URL (Enter confirm, Esc back):"}
          </Text>
          <Text>{""}</Text>
          <Text>
            {"    "}
            {textValue}
            <Text dimColor>█</Text>
          </Text>
        </Box>
      );

    case "addHeaders":
      return (
        <Box flexDirection="column">
          <Text dimColor>
            {"  Headers (a add, e edit, d delete, Enter confirm, Esc back):"}
          </Text>
          <Text dimColor>
            {"  Tip: use ${VAR} to reference environment variables"}
          </Text>
          <Text>{""}</Text>
          {headerKeys.length === 0 ? (
            <Text dimColor>{"    No headers configured."}</Text>
          ) : (
            headerKeys.map((k, i) => {
              const isCurrent = i === cursor;
              return (
                <Text key={k} color={isCurrent ? "cyan" : undefined}>
                  {"    "}
                  {isCurrent ? "❯" : " "} {k}:{" "}
                  {"*".repeat(pendingHeaders[k].length)}
                </Text>
              );
            })
          )}
        </Box>
      );

    case "addHeaderKey":
      return (
        <Box flexDirection="column">
          <Text dimColor>
            {"  Enter header name (Enter confirm, Esc back):"}
          </Text>
          <Text>{""}</Text>
          <Text>
            {"    "}
            {textValue}
            <Text dimColor>█</Text>
          </Text>
        </Box>
      );

    case "addHeaderValue":
      return (
        <Box flexDirection="column">
          <Text dimColor>
            {`  Enter value for ${pendingHeaderKey} (Enter confirm, Esc back):`}
          </Text>
          <Text>{""}</Text>
          <Text>
            {"    "}
            {"*".repeat(textValue.length)}
            <Text dimColor>█</Text>
          </Text>
        </Box>
      );

    case "addCommand":
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
            {textValue}
            <Text dimColor>█</Text>
          </Text>
        </Box>
      );

    case "connecting":
      if (connectError) {
        return (
          <Box flexDirection="column">
            <Text color="red">
              {"  Failed to connect: "}
              {connectError}
            </Text>
            <Text dimColor>{"  Press Esc to go back."}</Text>
          </Box>
        );
      }
      return <Text dimColor>{"  Connecting to MCP server..."}</Text>;
  }
}
