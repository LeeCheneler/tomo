import { Box, Text, useInput } from "ink";
import { useEffect, useRef, useState } from "react";
import type { McpServerConfig, McpToolConfig } from "../config";
import { useListNavigation } from "../hooks/use-list-navigation";
import { McpClient } from "../mcp/client";
import { HttpTransport } from "../mcp/http-transport";
import { StdioTransport } from "../mcp/stdio-transport";
import { type CheckboxItem, CheckboxList } from "./checkbox-list";
import { HintBar } from "./hint-bar";
import type { SettingsState } from "./settings-selector";
import { TextInput } from "./text-input";

type Step = "servers" | "serverForm" | "connecting";

type TransportType = "http" | "stdio";

interface KvItem {
  key: string;
  value: string;
  sensitive: boolean;
}

/** Row types for the unified server form. */
type FormRow =
  | { type: "transport" }
  | { type: "connection" }
  | { type: "kvSensitive"; index: number }
  | { type: "kvKey"; index: number }
  | { type: "kvValue"; index: number }
  | { type: "kvAdd" }
  | { type: "tool"; index: number }
  | { type: "connectAction" };

export interface McpServerSelectorProps {
  state: SettingsState;
  onUpdate: (partial: Partial<SettingsState>) => void;
  failedServers?: Set<string>;
  onBack: () => void;
}

/** Dedicated MCP server management UI with unified server form. */
export function McpServerSelector({
  state,
  onUpdate,
  failedServers,
  onBack,
}: McpServerSelectorProps) {
  const [step, setStep] = useState<Step>("servers");
  const serverNames = Object.keys(state.mcpServers);
  const [failed, setFailed] = useState<Set<string>>(failedServers ?? new Set());
  const [connectError, setConnectError] = useState<string | null>(null);
  const [reconnectName, setReconnectName] = useState<string | null>(null);

  // Active server being edited (null = new server form)
  const [activeServer, setActiveServer] = useState<string | null>(null);

  // Form state
  const [formTransport, setFormTransport] = useState<TransportType>("http");
  const [formConnection, setFormConnection] = useState("");
  const [formKv, setFormKv] = useState<KvItem[]>([]);
  const [formTools, setFormTools] = useState<McpToolConfig[]>([]);
  const [formConnected, setFormConnected] = useState(false);

  // Build form rows
  const formRows: FormRow[] = [];
  if (!activeServer) {
    formRows.push({ type: "transport" });
  }
  formRows.push({ type: "connection" });
  for (let i = 0; i < formKv.length; i++) {
    formRows.push({ type: "kvSensitive", index: i });
    formRows.push({ type: "kvKey", index: i });
    formRows.push({ type: "kvValue", index: i });
  }
  formRows.push({ type: "kvAdd" });
  for (let i = 0; i < formTools.length; i++) {
    formRows.push({ type: "tool", index: i });
  }
  formRows.push({ type: "connectAction" });

  const itemCount = (() => {
    switch (step) {
      case "servers":
        return serverNames.length + 1;
      case "serverForm":
        return formRows.length;
      default:
        return 0;
    }
  })();

  const { cursor, setCursor, handleUp, handleDown } =
    useListNavigation(itemCount);

  // Override cursor position after step change (e.g. jump to first tool after connect)
  const pendingCursorRef = useRef<number | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset cursor on step change
  useEffect(() => {
    if (pendingCursorRef.current !== null) {
      setCursor(pendingCursorRef.current);
      pendingCursorRef.current = null;
    } else {
      setCursor(0);
    }
  }, [step]);

  /** Convert Record<string, string> to KvItem array. */
  function recordToKv(
    record: Record<string, string>,
    sensitiveKeys?: string[],
  ): KvItem[] {
    const sensitive = new Set(sensitiveKeys ?? []);
    return Object.entries(record).map(([key, value]) => ({
      key,
      value,
      sensitive: sensitive.has(key),
    }));
  }

  /** Convert KvItem array to Record<string, string>. */
  function kvToRecord(items: KvItem[]): Record<string, string> | undefined {
    const filtered = items.filter((item) => item.key.trim());
    if (filtered.length === 0) return undefined;
    const record: Record<string, string> = {};
    for (const item of filtered) {
      record[item.key] = item.value;
    }
    return record;
  }

  /** Get sensitive key names from KvItem array. */
  function kvSensitiveKeys(items: KvItem[]): string[] | undefined {
    const keys = items
      .filter((item) => item.sensitive && item.key.trim())
      .map((item) => item.key);
    return keys.length > 0 ? keys : undefined;
  }

  /** Load form state from an existing server config. */
  function loadFormFromServer(name: string) {
    const server = state.mcpServers[name];
    const sk = (server as { sensitiveKeys?: string[] }).sensitiveKeys;
    setFormTransport(server.transport as TransportType);
    if (server.transport === "http") {
      setFormConnection((server as { url: string }).url);
      setFormKv(
        recordToKv(
          (server as { headers?: Record<string, string> }).headers ?? {},
          sk,
        ),
      );
    } else {
      const s = server as {
        command: string;
        args: string[];
        env?: Record<string, string>;
      };
      setFormConnection([s.command, ...s.args].join(" "));
      setFormKv(recordToKv(s.env ?? {}, sk));
    }
    setFormTools([...(server.tools ?? [])]);
    setFormConnected(true);
  }

  /** Reset form state for a new server. */
  function resetForm() {
    setFormTransport("http");
    setFormConnection("https://");
    setFormKv([]);
    setFormTools([]);
    setFormConnected(false);
    setConnectError(null);
  }

  /** Build a McpServerConfig from the current form state. */
  function buildConfig(): McpServerConfig {
    const kv = kvToRecord(formKv);
    const sk = kvSensitiveKeys(formKv);
    if (formTransport === "http") {
      return {
        transport: "http",
        url: formConnection.trim(),
        ...(kv ? { headers: kv } : {}),
        ...(sk ? { sensitiveKeys: sk } : {}),
        ...(formTools.length > 0 ? { tools: formTools } : {}),
      };
    }
    const parts = formConnection.trim().split(/\s+/);
    return {
      transport: "stdio",
      command: parts[0] ?? "",
      args: parts.slice(1),
      ...(kv ? { env: kv } : {}),
      ...(sk ? { sensitiveKeys: sk } : {}),
      ...(formTools.length > 0 ? { tools: formTools } : {}),
    };
  }

  /** Save the current form to an existing server. */
  function saveFormToServer() {
    if (!activeServer) return;
    onUpdate({
      mcpServers: {
        ...state.mcpServers,
        [activeServer]: buildConfig(),
      },
    });
  }

  // Connect effect
  // biome-ignore lint/correctness/useExhaustiveDependencies: only trigger on step changes
  useEffect(() => {
    if (step !== "connecting") return;
    let cancelled = false;

    (async () => {
      let client: McpClient | null = null;
      try {
        const config = buildConfig();
        const transport =
          config.transport === "stdio"
            ? new StdioTransport(
                (config as { command: string }).command,
                (config as { args: string[] }).args,
                (config as { env?: Record<string, string> }).env,
              )
            : new HttpTransport(
                (config as { url: string }).url,
                (config as { headers?: Record<string, string> }).headers,
              );

        client = new McpClient(transport);
        const initResult = await client.initialize();
        const tools = await client.listTools();
        client.close();
        client = null;

        if (cancelled) return;

        // Preserve enabled state for tools that existed before reload
        const existingEnabled = new Map(
          formTools.map((t) => [t.name, t.enabled]),
        );
        const discoveredTools: McpToolConfig[] = tools.map((t) => ({
          name: t.name,
          enabled: existingEnabled.get(t.name) ?? true,
          description: t.description,
        }));

        if (reconnectName) {
          setFailed((prev) => {
            const next = new Set(prev);
            next.delete(reconnectName);
            return next;
          });
          setReconnectName(null);
          setStep("servers");
        } else if (activeServer) {
          // Reload — stay on connectAction (last row)
          const totalRows =
            1 + formKv.length * 3 + 1 + discoveredTools.length + 1;
          pendingCursorRef.current = totalRows - 1;
          setFormTools(discoveredTools);
          setFormConnected(true);
          setConnectError(null);
          saveFormToServer();
          setStep("serverForm");
        } else {
          let serverName = initResult.serverInfo.name;
          if (state.mcpServers[serverName]) {
            let suffix = 2;
            while (state.mcpServers[`${serverName}-${suffix}`]) {
              suffix++;
            }
            serverName = `${serverName}-${suffix}`;
          }

          const config = buildConfig();
          onUpdate({
            mcpServers: {
              ...state.mcpServers,
              [serverName]: { ...config, tools: discoveredTools },
            },
          });
          // New server — jump to first tool if any were discovered
          const kvRows = formKv.length * 3;
          // Rows: transport(1) + connection(1) + kvRows + kvAdd(1) = first tool index
          const firstToolIdx = 1 + 1 + kvRows + 1;
          if (discoveredTools.length > 0) {
            pendingCursorRef.current = firstToolIdx;
          }
          setFormTools(discoveredTools);
          setFormConnected(true);
          setActiveServer(serverName);
          setConnectError(null);
          setStep("serverForm");
        }
      } catch (err) {
        client?.close();
        if (cancelled) return;
        setConnectError(
          err instanceof Error ? err.message : "Connection failed",
        );
        setStep("serverForm");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [step]);

  const isTextInputRow = (row: FormRow) =>
    row.type === "connection" || row.type === "kvKey" || row.type === "kvValue";

  useInput((input, key) => {
    if (key.escape) {
      if (step === "servers") {
        onBack();
      } else if (step === "serverForm") {
        if (activeServer) {
          saveFormToServer();
        }
        setActiveServer(null);
        setConnectError(null);
        setStep("servers");
      } else if (step === "connecting") {
        setConnectError(null);
        setStep("serverForm");
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
          const name = serverNames[cursor];
          setActiveServer(name);
          loadFormFromServer(name);
          setStep("serverForm");
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
          setConnectError(null);
          setStep("connecting");
        } else if (
          input === "a" ||
          input === "A" ||
          ((input === " " || key.return) && isOnAdd)
        ) {
          setActiveServer(null);
          resetForm();
          setStep("serverForm");
        }
        break;
      }

      case "serverForm": {
        const row = formRows[cursor];
        if (!row) break;

        // TextInput rows handle their own key events when focused.
        // Only intercept navigation — no shortcut keys.
        if (isTextInputRow(row)) {
          if (key.upArrow) {
            handleUp();
          } else if (key.downArrow) {
            handleDown();
          }
          break;
        }

        if (key.upArrow) {
          handleUp();
        } else if (key.downArrow) {
          handleDown();
        } else if (row.type === "transport") {
          if (key.leftArrow || key.rightArrow || input === " ") {
            const newType = formTransport === "http" ? "stdio" : "http";
            setFormTransport(newType);
            setFormConnection(newType === "http" ? "https://" : "");
            setFormKv([]);
            setFormTools([]);
            setFormConnected(false);
            setConnectError(null);
          }
        } else if (row.type === "kvSensitive") {
          if (input === " ") {
            setFormKv((prev) =>
              prev.map((item, i) =>
                i === row.index
                  ? { ...item, sensitive: !item.sensitive }
                  : item,
              ),
            );
          } else if (input === "d" || input === "D") {
            setFormKv((prev) => prev.filter((_, i) => i !== row.index));
          }
        } else if (row.type === "kvAdd") {
          if (input === "a" || input === "A" || input === " " || key.return) {
            setFormKv((prev) => [
              ...prev,
              { key: "", value: "", sensitive: false },
            ]);
            // Cursor stays at current position — the new item's sensitive
            // row takes the slot where kvAdd was, pushing kvAdd down.
            setCursor(cursor);
          }
        } else if (row.type === "tool") {
          if (input === " ") {
            const tool = formTools[row.index];
            if (tool) {
              const updated = formTools.map((t, i) =>
                i === row.index ? { ...t, enabled: !t.enabled } : t,
              );
              setFormTools(updated);
              if (activeServer) {
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
            }
          }
        } else if (row.type === "connectAction") {
          if (input === " " || key.return) {
            setConnectError(null);
            setStep("connecting");
          }
        }
        break;
      }

      case "connecting":
        break;
    }
  });

  // ─── Rendering ───

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
          <HintBar
            label="MCP Servers"
            hints={[
              { key: "Space", action: "toggle" },
              { key: "Enter", action: "open" },
              { key: "a", action: "add" },
              { key: "d", action: "delete" },
              { key: "r", action: "reconnect" },
              { key: "Esc", action: "back" },
            ]}
          />
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

    case "serverForm": {
      const title = activeServer ?? "New Server";
      const kvLabel =
        formTransport === "http" ? "Headers" : "Environment Variables";

      return (
        <Box flexDirection="column">
          <HintBar
            label={title}
            hints={[
              { key: "Space", action: "toggle" },
              { key: "d", action: "delete" },
              { key: "Esc", action: "back" },
            ]}
          />
          {!activeServer && !formConnected && (
            <Text dimColor color="yellow">
              {"  ⚠ Leave without connecting to discard"}
            </Text>
          )}
          <Text>{""}</Text>

          {formRows.map((row, i) => {
            const isCurrent = i === cursor;
            const prefix = `    ${isCurrent ? "❯" : " "} `;

            switch (row.type) {
              case "transport":
                return (
                  <Text key="transport" color={isCurrent ? "cyan" : undefined}>
                    {prefix}Type:{" "}
                    {formTransport === "http" ? (
                      <Text>
                        <Text bold color="cyan">
                          http
                        </Text>
                        {" / "}
                        <Text dimColor>stdio</Text>
                      </Text>
                    ) : (
                      <Text>
                        <Text dimColor>http</Text>
                        {" / "}
                        <Text bold color="cyan">
                          stdio
                        </Text>
                      </Text>
                    )}
                  </Text>
                );

              case "connection":
                return (
                  <Box key="connection">
                    <Text color={isCurrent ? "cyan" : undefined}>
                      {prefix}
                      {formTransport === "http" ? "URL" : "Command"}:{" "}
                    </Text>
                    <TextInput
                      value={formConnection}
                      onChange={setFormConnection}
                      active={isCurrent}
                    />
                  </Box>
                );

              case "kvSensitive": {
                const item = formKv[row.index];
                const isFirstOfGroup = !formRows.some(
                  (r, ri) =>
                    ri < i &&
                    (r.type === "kvSensitive" ||
                      r.type === "kvKey" ||
                      r.type === "kvValue"),
                );
                return (
                  <Box key={`kv-s-${row.index}`} flexDirection="column">
                    {isFirstOfGroup && (
                      <Text dimColor>{`\n    ── ${kvLabel} ──`}</Text>
                    )}
                    {row.index > 0 && <Text> </Text>}
                    <Text color={isCurrent ? "cyan" : undefined}>
                      {"    "}
                      <Text color={isCurrent ? "cyan" : undefined}>
                        {isCurrent ? "❯" : " "}
                      </Text>{" "}
                      {item.sensitive ? (
                        <Text color="green">[✔]</Text>
                      ) : (
                        <Text dimColor>[ ]</Text>
                      )}{" "}
                      Sensitive
                    </Text>
                  </Box>
                );
              }

              case "kvKey": {
                const item = formKv[row.index];
                return (
                  <Box key={`kv-k-${row.index}`}>
                    <Text color={isCurrent ? "cyan" : undefined}>
                      {prefix}Name:{" "}
                    </Text>
                    <TextInput
                      value={item.key}
                      onChange={(v) =>
                        setFormKv((prev) =>
                          prev.map((it, idx) =>
                            idx === row.index ? { ...it, key: v } : it,
                          ),
                        )
                      }
                      active={isCurrent}
                    />
                  </Box>
                );
              }

              case "kvValue": {
                const item = formKv[row.index];
                return (
                  <Box key={`kv-v-${row.index}`}>
                    <Text color={isCurrent ? "cyan" : undefined}>
                      {prefix}Value:{" "}
                    </Text>
                    <TextInput
                      value={item.value}
                      onChange={(v) =>
                        setFormKv((prev) =>
                          prev.map((it, idx) =>
                            idx === row.index ? { ...it, value: v } : it,
                          ),
                        )
                      }
                      active={isCurrent}
                      masked={item.sensitive}
                    />
                  </Box>
                );
              }

              case "kvAdd": {
                const hasKv = formKv.length > 0;
                return (
                  <Box key="kv-add" flexDirection="column">
                    {!hasKv && <Text dimColor>{`\n    ── ${kvLabel} ──`}</Text>}
                    {hasKv && <Text> </Text>}
                    <Text color={isCurrent ? "cyan" : "dim"}>
                      {prefix}[+] Add...
                    </Text>
                  </Box>
                );
              }

              case "tool": {
                const tool = formTools[row.index];
                const isFirst = row.index === 0;
                return (
                  <Box key={`tool-${tool.name}`} flexDirection="column">
                    {isFirst && <Text dimColor>{"\n    ── Tools ──"}</Text>}
                    <Text>
                      {"    "}
                      <Text color={isCurrent ? "cyan" : undefined}>
                        {isCurrent ? "❯" : " "}
                      </Text>{" "}
                      {tool.enabled ? (
                        <Text color="green">[✔]</Text>
                      ) : (
                        <Text dimColor>[ ]</Text>
                      )}{" "}
                      <Text color="cyan">{tool.name}</Text>
                      {tool.description && (
                        <Text color="cyan" dimColor>
                          {"  "}
                          {tool.description}
                        </Text>
                      )}
                    </Text>
                  </Box>
                );
              }

              case "connectAction": {
                const hasTools = formTools.length > 0;
                const label = hasTools ? "[+] Reload tools" : "[+] Connect";
                return (
                  <Box key="connect" flexDirection="column">
                    {!hasTools && <Text dimColor>{"\n    ── Tools ──"}</Text>}
                    <Text color={isCurrent ? "cyan" : "dim"}>
                      {prefix}
                      {label}
                    </Text>
                    {connectError && (
                      <Text color="red">
                        {"        ⚠ "}
                        {connectError}
                      </Text>
                    )}
                  </Box>
                );
              }
              default:
                return null;
            }
          })}
        </Box>
      );
    }

    case "connecting":
      return <Text dimColor>{"  Connecting to MCP server..."}</Text>;
  }
}
