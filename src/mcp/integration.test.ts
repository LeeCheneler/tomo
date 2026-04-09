import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { mockToolContext } from "../test-utils/stub-context";
import { createToolRegistry } from "../tools/registry";
import type { McpManager } from "./manager";
import { createMcpManager } from "./manager";
import { createMcpTool, encodeMcpToolName } from "./tool-adapter";

const STDIO_MOCK = resolve(__dirname, "../../mock-mcps/stdio.mjs");

describe("MCP end-to-end (stdio)", () => {
  let manager: McpManager | null = null;

  afterEach(async () => {
    if (manager) {
      await manager.stopAll();
      manager = null;
    }
  });

  it("connects to mock stdio server, registers tools, and dispatches a call through the adapter", async () => {
    manager = createMcpManager();
    const result = await manager.startAll({
      mock: {
        transport: "stdio",
        command: "node",
        args: [STDIO_MOCK],
        enabled: true,
      },
    });
    expect(result.failed).toEqual([]);
    expect(result.started).toHaveLength(1);

    const registry = createToolRegistry();
    const started = result.started[0];
    for (const def of started.tools) {
      registry.register(createMcpTool(started.name, def, manager));
    }

    // Tool is registered with the namespaced name and accessible to the agent loop.
    const toolName = encodeMcpToolName("mock", "coin_flip");
    const tool = registry.get(toolName);
    expect(tool).toBeDefined();

    // Calling it actually dispatches to the live mock subprocess.
    const callResult = await tool?.execute({}, mockToolContext());
    expect(callResult?.status).toBe("ok");
    expect(["Heads", "Tails"]).toContain(callResult?.output);
  });

  it("propagates abort to a tool call mid-flight", async () => {
    manager = createMcpManager();
    const result = await manager.startAll({
      mock: {
        transport: "stdio",
        command: "node",
        args: [STDIO_MOCK],
        enabled: true,
      },
    });
    expect(result.started).toHaveLength(1);

    const started = result.started[0];
    const tool = createMcpTool(
      started.name,
      started.tools.find((t) => t.name === "get_time") ?? started.tools[0],
      manager,
    );

    const controller = new AbortController();
    controller.abort();
    const callResult = await tool.execute(
      { timezone: "UTC" },
      mockToolContext({ signal: controller.signal }),
    );
    expect(callResult.status).toBe("error");
    expect(callResult.output).toBe("Aborted");
  });
});
