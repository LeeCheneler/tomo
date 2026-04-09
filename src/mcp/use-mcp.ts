import { useEffect, useRef } from "react";
import { useConfig } from "../config/hook";
import type { ToolRegistry } from "../tools/registry";
import { createMcpManager } from "./manager";
import { createMcpTool } from "./tool-adapter";

/** Props for useMcp. */
export interface UseMcpProps {
  /** Tool registry that MCP tools should be added to and removed from. */
  toolRegistry: ToolRegistry;
  /** Called once per server that fails to connect, with the server name and error message. */
  onConnectionError: (serverName: string, error: string) => void;
}

/**
 * Hook that owns the MCP manager lifecycle for the chat session.
 *
 * On mount, connects to all enabled MCP servers in the background and
 * registers their tools into the shared tool registry as each server comes
 * up. Connection failures are surfaced via `onConnectionError`. On unmount,
 * the manager disconnects every server and the registered tools are removed
 * from the registry.
 *
 * Re-runs when `config.mcp.connections` changes (e.g. after settings save).
 */
export function useMcp(props: UseMcpProps) {
  const { config } = useConfig();

  // Refs for callbacks so the effect doesn't re-run on every parent render.
  const onConnectionErrorRef = useRef(props.onConnectionError);
  onConnectionErrorRef.current = props.onConnectionError;
  const toolRegistryRef = useRef(props.toolRegistry);
  toolRegistryRef.current = props.toolRegistry;

  useEffect(() => {
    const manager = createMcpManager();
    let cancelled = false;
    const localRegisteredNames = new Set<string>();

    (async () => {
      const result = await manager.startAll(config.mcp.connections);

      // If the effect was torn down while we were connecting, throw away
      // the result and stop the manager so the new effect run can take over.
      if (cancelled) {
        await manager.stopAll();
        return;
      }

      const registry = toolRegistryRef.current;
      for (const { name, tools } of result.started) {
        for (const def of tools) {
          const tool = createMcpTool(name, def, manager);
          registry.register(tool);
          localRegisteredNames.add(tool.name);
        }
      }

      for (const { name, error } of result.failed) {
        onConnectionErrorRef.current(name, error);
      }
    })();

    return () => {
      cancelled = true;
      const registry = toolRegistryRef.current;
      for (const name of localRegisteredNames) {
        registry.unregister(name);
      }
      void manager.stopAll();
    };
  }, [config.mcp.connections]);
}
