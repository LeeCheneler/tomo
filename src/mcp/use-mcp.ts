import { useEffect, useRef } from "react";
import { useConfig } from "../config/hook";
import type { ToolRegistry } from "../tools/registry";
import { createMcpClient } from "./client";
import { createMcpManager } from "./manager";
import { type McpAuthStore, createMcpAuthStore } from "./mcp-auth-store";
import { createMcpTool } from "./tool-adapter";

/** Props for useMcp. */
export interface UseMcpProps {
  /** Tool registry that MCP tools should be added to and removed from. */
  toolRegistry: ToolRegistry;
  /** Called once per server that fails to connect, with the server name and error message. */
  onConnectionError: (serverName: string, error: string) => void;
  /**
   * Optional pre-built auth store. When omitted, one is created internally
   * and persisted across effect runs via a ref. Injected primarily for
   * tests that need a handle on the same store the chat UI subscribes to.
   */
  authStore?: McpAuthStore;
}

/** Return value of useMcp. */
export interface UseMcpResult {
  /** Store of in-progress OAuth auth prompts — consumed by the chat UI. */
  authStore: McpAuthStore;
}

/**
 * Hook that owns the MCP manager lifecycle for the chat session.
 *
 * On mount, connects to all enabled MCP servers in the background and
 * registers their tools into the shared tool registry as each server comes
 * up. Connection failures are surfaced via `onConnectionError`. HTTP servers
 * that drive the user through OAuth push modal entries onto `authStore`, which
 * the chat UI renders via `useSyncExternalStore`. On unmount, the manager
 * disconnects every server and the registered tools are removed from the
 * registry.
 *
 * Re-runs when `config.mcp.connections` changes (e.g. after settings save).
 */
export function useMcp(props: UseMcpProps): UseMcpResult {
  const { config } = useConfig();

  // Refs for callbacks so the effect doesn't re-run on every parent render.
  const onConnectionErrorRef = useRef(props.onConnectionError);
  onConnectionErrorRef.current = props.onConnectionError;
  const toolRegistryRef = useRef(props.toolRegistry);
  toolRegistryRef.current = props.toolRegistry;

  // The auth store lives across effect runs — re-mounting it would orphan
  // any in-progress modals the chat UI is already subscribed to. Tests can
  // inject their own store via props; otherwise we lazy-init one in a ref
  // on first render and pin it for the rest of the hook's lifetime.
  const authStoreRef = useRef<McpAuthStore | null>(null);
  if (authStoreRef.current === null) {
    authStoreRef.current = props.authStore ?? createMcpAuthStore();
  }
  const authStore = authStoreRef.current;

  useEffect(() => {
    const manager = createMcpManager((name, connection) =>
      createMcpClient(name, connection, { authUi: authStore }),
    );
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
  }, [config.mcp.connections, authStore]);

  return { authStore };
}
