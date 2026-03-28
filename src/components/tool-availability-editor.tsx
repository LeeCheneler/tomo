import { Box, Text, useInput } from "ink";
import { useListNavigation } from "../hooks/use-list-navigation";
import type { CheckboxItem } from "./checkbox-list";
import { HintBar } from "./hint-bar";
import type { SettingsState, ToolMeta } from "./settings-selector";

export interface ToolAvailabilityEditorProps {
  state: SettingsState;
  toolMeta: ToolMeta;
  onUpdate: (partial: Partial<SettingsState>) => void;
  onBack: () => void;
}

/** Tool availability editor with built-in tools and MCP tools grouped by server. */
export function ToolAvailabilityEditor({
  state,
  toolMeta,
  onUpdate,
  onBack,
}: ToolAvailabilityEditorProps) {
  type ToolItem =
    | { type: "builtin"; name: string }
    | { type: "mcp"; serverName: string; toolIndex: number };

  const allToolItems: ToolItem[] = [];
  for (const name of toolMeta.names) {
    allToolItems.push({ type: "builtin", name });
  }
  for (const serverName of Object.keys(state.mcpServers)) {
    const server = state.mcpServers[serverName];
    if (server.enabled === false) continue;
    for (let i = 0; i < (server.tools ?? []).length; i++) {
      allToolItems.push({ type: "mcp", serverName, toolIndex: i });
    }
  }

  const { cursor, handleUp, handleDown } = useListNavigation(
    allToolItems.length,
  );

  useInput((input, key) => {
    if (key.escape) {
      onBack();
      return;
    }

    if (key.upArrow) {
      handleUp();
    } else if (key.downArrow) {
      handleDown();
    } else if (input === " ") {
      const item = allToolItems[cursor];
      if (item?.type === "builtin") {
        onUpdate({
          toolAvailability: {
            ...state.toolAvailability,
            [item.name]: !state.toolAvailability[item.name],
          },
        });
      } else if (item?.type === "mcp") {
        const server = state.mcpServers[item.serverName];
        const toolList = server?.tools ?? [];
        const tool = toolList[item.toolIndex];
        if (tool) {
          const updatedTools = toolList.map((t, i) =>
            i === item.toolIndex ? { ...t, enabled: !t.enabled } : t,
          );
          onUpdate({
            mcpServers: {
              ...state.mcpServers,
              [item.serverName]: { ...server, tools: updatedTools },
            },
          });
        }
      }
    }
  });

  const builtInItems: CheckboxItem[] = toolMeta.names.map((name) => ({
    key: name,
    label: toolMeta.displayNames[name] ?? name,
    description: toolMeta.descriptions[name],
    checked: state.toolAvailability[name] ?? true,
    warning:
      (state.toolAvailability[name] ?? true)
        ? toolMeta.warnings[name]
        : undefined,
  }));

  const mcpSections: { serverName: string; startIndex: number }[] = [];
  let idx = toolMeta.names.length;
  for (const serverName of Object.keys(state.mcpServers)) {
    const server = state.mcpServers[serverName];
    if (server.enabled === false) continue;
    const serverTools = server.tools ?? [];
    if (serverTools.length > 0) {
      mcpSections.push({ serverName, startIndex: idx });
      idx += serverTools.length;
    }
  }

  const mcpItems: CheckboxItem[] = [];
  for (const serverName of Object.keys(state.mcpServers)) {
    const server = state.mcpServers[serverName];
    if (server.enabled === false) continue;
    for (const tool of server.tools ?? []) {
      mcpItems.push({
        key: `${serverName}__${tool.name}`,
        label: tool.name,
        description: tool.description,
        checked: tool.enabled,
      });
    }
  }

  const allItems = [...builtInItems, ...mcpItems];
  const maxLabel = Math.max(...allItems.map((item) => item.label.length), 0);

  return (
    <Box flexDirection="column">
      <HintBar
        label="Tool Availability"
        hints={[
          { key: "Space", action: "toggle" },
          { key: "Esc", action: "back" },
        ]}
      />
      <Text>{""}</Text>
      {builtInItems.map((item, i) => {
        const isCurrent = i === cursor;
        return (
          <Box key={item.key} flexDirection="column">
            <Text>
              {"    "}
              <Text color={isCurrent ? "cyan" : undefined}>
                {isCurrent ? "❯" : " "}
              </Text>{" "}
              {item.checked ? (
                <Text color="green">[✔]</Text>
              ) : (
                <Text dimColor>[ ]</Text>
              )}{" "}
              <Text color="cyan">{item.label.padEnd(maxLabel)}</Text>
              {item.description && (
                <Text color="cyan" dimColor>
                  {"  "}
                  {item.description}
                </Text>
              )}
            </Text>
            {item.warning && (
              <Text color="yellow">
                {"        ⚠ "}
                {item.warning}
              </Text>
            )}
          </Box>
        );
      })}
      {mcpSections.map(({ serverName, startIndex }) => {
        const server = state.mcpServers[serverName];
        const serverTools = server.tools ?? [];
        return (
          <Box key={serverName} flexDirection="column">
            <Text>{""}</Text>
            <Text dimColor>
              {"    MCP → "}
              {serverName}
            </Text>
            {serverTools.map((tool, ti) => {
              const globalIdx = startIndex + ti;
              const isCurrent = globalIdx === cursor;
              return (
                <Box key={tool.name} flexDirection="column">
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
                    <Text color="cyan">{tool.name.padEnd(maxLabel)}</Text>
                    {tool.description && (
                      <Text color="cyan" dimColor>
                        {"  "}
                        {tool.description}
                      </Text>
                    )}
                  </Text>
                </Box>
              );
            })}
          </Box>
        );
      })}
    </Box>
  );
}
