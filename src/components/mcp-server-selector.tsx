import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import type { McpServerConfig, McpToolConfig } from "../config";
import { useListNavigation } from "../hooks/use-list-navigation";
import { McpClient } from "../mcp/client";
import { HttpTransport } from "../mcp/http-transport";
import { StdioTransport } from "../mcp/stdio-transport";
import { type CheckboxItem, CheckboxList } from "./checkbox-list";

type Step =
  | "servers"
  | "serverTools"
  | "addType"
  | "addUrl"
  | "addCommand"
  | "connecting";

const TRANSPORT_TYPES = ["http", "stdio"] as const;

export interface McpServerSelectorProps {
  servers: Record<string, McpServerConfig>;
  failedServers?: Set<string>;
  onAddServer: (name: string, server: McpServerConfig) => void;
  onRemoveServer: (name: string) => void;
  onToggleServer: (name: string, enabled: boolean) => void;
  onUpdateTools: (serverName: string, tools: McpToolConfig[]) => void;
  onBack: () => void;
}

/** Dedicated MCP server management UI with per-server tool toggles. */
export function McpServerSelector({
  servers,
  failedServers,
  onAddServer,
  onRemoveServer,
  onToggleServer,
  onUpdateTools,
  onBack,
}: McpServerSelectorProps) {
  const [step, setStep] = useState<Step>("servers");
  const [serverList, setServerList] = useState(servers);
  const serverNames = Object.keys(serverList);
  const [failed, setFailed] = useState<Set<string>>(failedServers ?? new Set());
  const [textValue, setTextValue] = useState("");
  const [connectError, setConnectError] = useState<string | null>(null);
  const [pendingConfig, setPendingConfig] = useState<McpServerConfig | null>(
    null,
  );
  const [reconnectName, setReconnectName] = useState<string | null>(null);
  const [activeServer, setActiveServer] = useState<string | null>(null);

  const activeTools = activeServer
    ? (serverList[activeServer]?.tools ?? [])
    : [];

  const itemCount = (() => {
    switch (step) {
      case "servers":
        return serverNames.length + 1;
      case "serverTools":
        return activeTools.length;
      case "addType":
        return TRANSPORT_TYPES.length;
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
          if (serverList[serverName]) {
            let suffix = 2;
            while (serverList[`${serverName}-${suffix}`]) {
              suffix++;
            }
            serverName = `${serverName}-${suffix}`;
          }

          const serverWithTools = {
            ...pendingConfig,
            tools: tools.map((t) => ({
              name: t.name,
              enabled: false,
              description: t.description,
            })),
          };

          onAddServer(serverName, serverWithTools);
          setServerList((prev) => ({
            ...prev,
            [serverName]: serverWithTools,
          }));
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

  const subSteps: Step[] = ["addType", "addUrl", "addCommand", "connecting"];

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
        setReconnectName(null);
        setStep("servers");
      }
      return;
    }

    if (input === "q" || input === "Q") {
      if (step === "servers") {
        onBack();
      } else if (step === "serverTools") {
        setActiveServer(null);
        setStep("servers");
      } else if (subSteps.includes(step)) {
        setTextValue("");
        setConnectError(null);
        setPendingConfig(null);
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
          const server = serverList[name];
          const currentEnabled = server.enabled !== false;
          onToggleServer(name, !currentEnabled);
          setServerList((prev) => ({
            ...prev,
            [name]: { ...prev[name], enabled: !currentEnabled },
          }));
        } else if (key.return && !isOnAdd) {
          const name = serverNames[cursor];
          setActiveServer(name);
          setStep("serverTools");
        } else if ((input === "d" || input === "D") && !isOnAdd) {
          const name = serverNames[cursor];
          onRemoveServer(name);
          setServerList((prev) => {
            const next = { ...prev };
            delete next[name];
            return next;
          });
          if (cursor >= serverNames.length - 1) {
            setCursor((c) => Math.max(0, c - 1));
          }
        } else if (
          (input === "r" || input === "R") &&
          !isOnAdd &&
          failed.has(serverNames[cursor])
        ) {
          const name = serverNames[cursor];
          const server = serverList[name];
          setReconnectName(name);
          setPendingConfig(server);
          setConnectError(null);
          setStep("connecting");
        } else if (
          input === "a" ||
          input === "A" ||
          ((input === " " || key.return) && isOnAdd)
        ) {
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
        } else if ((input === " " || key.return) && activeServer) {
          const tool = activeTools[cursor];
          if (!tool) break;
          const updated = activeTools.map((t) =>
            t.name === tool.name ? { ...t, enabled: !t.enabled } : t,
          );
          onUpdateTools(activeServer, updated);
          setServerList((prev) => ({
            ...prev,
            [activeServer]: { ...prev[activeServer], tools: updated },
          }));
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
          setPendingConfig({ transport: "http", url });
          setConnectError(null);
          setStep("connecting");
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
        const server = serverList[name];
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
              "  MCP Servers (Space toggle, Enter tools, d delete, a add, r reconnect, Esc back):"
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
            {`  ${activeServer} — Tools (Space/Enter toggle, Esc back):`}
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
