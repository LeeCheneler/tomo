import { afterEach, describe, expect, it, vi } from "vitest";
import { createToolRegistry } from "../tools/registry";
import type { ToolRegistry } from "../tools/registry";
import { renderInk } from "../test-utils/ink";
import type { McpClient, McpToolDefinition } from "./client";
import type { McpManager, StartAllResult } from "./manager";
import { useMcp } from "./use-mcp";

vi.mock("./manager", async () => {
  const actual = await vi.importActual<typeof import("./manager")>("./manager");
  return {
    ...actual,
    createMcpManager: vi.fn(),
  };
});

const { createMcpManager } = await import("./manager");

/** Builds a fake McpClient that records callTool invocations. */
function fakeClient(): McpClient {
  return {
    connect: vi.fn(async () => {}),
    listTools: vi.fn(async () => []),
    callTool: vi.fn(async () => ({ text: "ok", isError: false })),
    disconnect: vi.fn(async () => {}),
  };
}

/** Builds a fake McpManager whose startAll resolves to the given result. */
function fakeManager(
  startAllResult: StartAllResult,
  clients: Map<string, McpClient>,
): McpManager {
  const stopAll = vi.fn(async () => {});
  return {
    startAll: vi.fn(async () => startAllResult),
    start: vi.fn(),
    stop: vi.fn(),
    stopAll,
    getClient: (name: string) => clients.get(name),
    listConnected: () => [...clients.keys()],
  };
}

const sampleTool: McpToolDefinition = {
  name: "get_time",
  description: "Returns the time",
  inputSchema: { type: "object", properties: {} },
};

/** Test harness component that calls useMcp with the given props. */
function Harness(props: {
  toolRegistry: ToolRegistry;
  onConnectionError: (name: string, error: string) => void;
}) {
  useMcp({
    toolRegistry: props.toolRegistry,
    onConnectionError: props.onConnectionError,
  });
  return null;
}

describe("useMcp", () => {
  afterEach(() => {
    vi.mocked(createMcpManager).mockReset();
  });

  it("registers tools from successfully started servers into the registry", async () => {
    const mockClient = fakeClient();
    const clients = new Map<string, McpClient>([["mock", mockClient]]);
    const manager = fakeManager(
      {
        started: [{ name: "mock", client: mockClient, tools: [sampleTool] }],
        failed: [],
      },
      clients,
    );
    vi.mocked(createMcpManager).mockReturnValue(manager);

    const registry = createToolRegistry();
    const onError = vi.fn();
    renderInk(<Harness toolRegistry={registry} onConnectionError={onError} />, {
      global: {
        mcp: {
          connections: {
            mock: {
              transport: "stdio",
              command: "node",
              args: [],
              enabled: true,
            },
          },
        },
      },
    });

    // Wait a microtask cycle for startAll to resolve and tools to register.
    await new Promise((resolve) => setTimeout(resolve, 0));

    const tool = registry.get("mcp__mock__get_time");
    expect(tool).toBeDefined();
    expect(tool?.displayName).toBe("mock/get_time");
    expect(onError).not.toHaveBeenCalled();
  });

  it("calls onConnectionError for each failed server", async () => {
    const manager = fakeManager(
      {
        started: [],
        failed: [
          { name: "broken", error: "process exited" },
          { name: "also-broken", error: "ENOENT" },
        ],
      },
      new Map(),
    );
    vi.mocked(createMcpManager).mockReturnValue(manager);

    const registry = createToolRegistry();
    const onError = vi.fn();
    renderInk(<Harness toolRegistry={registry} onConnectionError={onError} />, {
      global: {
        mcp: {
          connections: {
            broken: {
              transport: "stdio",
              command: "x",
              args: [],
              enabled: true,
            },
            "also-broken": {
              transport: "stdio",
              command: "x",
              args: [],
              enabled: true,
            },
          },
        },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onError).toHaveBeenCalledTimes(2);
    expect(onError).toHaveBeenCalledWith("broken", "process exited");
    expect(onError).toHaveBeenCalledWith("also-broken", "ENOENT");
    expect(registry.list()).toHaveLength(0);
  });

  it("registers tools from started servers even if other servers fail", async () => {
    const goodClient = fakeClient();
    const clients = new Map<string, McpClient>([["good", goodClient]]);
    const manager = fakeManager(
      {
        started: [{ name: "good", client: goodClient, tools: [sampleTool] }],
        failed: [{ name: "bad", error: "oops" }],
      },
      clients,
    );
    vi.mocked(createMcpManager).mockReturnValue(manager);

    const registry = createToolRegistry();
    const onError = vi.fn();
    renderInk(<Harness toolRegistry={registry} onConnectionError={onError} />, {
      global: {
        mcp: {
          connections: {
            good: {
              transport: "stdio",
              command: "node",
              args: [],
              enabled: true,
            },
            bad: {
              transport: "stdio",
              command: "x",
              args: [],
              enabled: true,
            },
          },
        },
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(registry.get("mcp__good__get_time")).toBeDefined();
    expect(onError).toHaveBeenCalledWith("bad", "oops");
  });

  it("unregisters tools and calls stopAll on unmount", async () => {
    const mockClient = fakeClient();
    const clients = new Map<string, McpClient>([["mock", mockClient]]);
    const manager = fakeManager(
      {
        started: [{ name: "mock", client: mockClient, tools: [sampleTool] }],
        failed: [],
      },
      clients,
    );
    vi.mocked(createMcpManager).mockReturnValue(manager);

    const registry = createToolRegistry();
    const { unmount } = renderInk(
      <Harness toolRegistry={registry} onConnectionError={vi.fn()} />,
      {
        global: {
          mcp: {
            connections: {
              mock: {
                transport: "stdio",
                command: "node",
                args: [],
                enabled: true,
              },
            },
          },
        },
      },
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(registry.get("mcp__mock__get_time")).toBeDefined();

    unmount();
    expect(registry.get("mcp__mock__get_time")).toBeUndefined();
    expect(manager.stopAll).toHaveBeenCalled();
  });

  it("stops the manager and skips registration when unmounted before startAll resolves", async () => {
    // Build a manager whose startAll is intentionally slow so we can unmount
    // the harness mid-flight.
    let resolveStartAll: () => void = () => {};
    const startAll = vi.fn(
      () =>
        new Promise<StartAllResult>((resolve) => {
          resolveStartAll = () => resolve({ started: [], failed: [] });
        }),
    );
    const stopAll = vi.fn(async () => {});
    const manager: McpManager = {
      startAll,
      start: vi.fn(),
      stop: vi.fn(),
      stopAll,
      getClient: () => undefined,
      listConnected: () => [],
    };
    vi.mocked(createMcpManager).mockReturnValue(manager);

    const registry = createToolRegistry();
    const { unmount } = renderInk(
      <Harness toolRegistry={registry} onConnectionError={vi.fn()} />,
      {
        global: {
          mcp: {
            connections: {
              slow: {
                transport: "stdio",
                command: "node",
                args: [],
                enabled: true,
              },
            },
          },
        },
      },
    );

    // Unmount before startAll resolves, then let it resolve — the cancelled
    // path should stop the manager and skip registering any tools.
    unmount();
    resolveStartAll();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(registry.list()).toHaveLength(0);
    // stopAll is called twice: once for the cancelled branch, once from the
    // cleanup. Both paths are intended.
    expect(stopAll).toHaveBeenCalled();
  });

  it("does not call onConnectionError when there are no servers configured", async () => {
    const manager = fakeManager({ started: [], failed: [] }, new Map());
    vi.mocked(createMcpManager).mockReturnValue(manager);

    const onError = vi.fn();
    renderInk(
      <Harness
        toolRegistry={createToolRegistry()}
        onConnectionError={onError}
      />,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onError).not.toHaveBeenCalled();
  });
});
