import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { McpConnection } from "../config/schema";
import type { McpClient } from "./client";
import type { McpManager } from "./manager";
import { createMcpManager } from "./manager";

const STDIO_MOCK = resolve(__dirname, "../../mock-mcps/stdio.mjs");

/** Builds a stdio connection pointing at the mock server. */
function mockStdioConnection(): McpConnection {
  return {
    transport: "stdio",
    command: "node",
    args: [STDIO_MOCK],
    enabled: true,
  };
}

describe("createMcpManager", () => {
  let manager: McpManager | null = null;

  afterEach(async () => {
    if (manager) {
      await manager.stopAll();
      manager = null;
    }
  });

  it("starts a single server with start()", async () => {
    manager = createMcpManager();
    const result = await manager.start("mock", mockStdioConnection());
    expect(result.name).toBe("mock");
    expect(result.tools.map((t) => t.name).sort()).toEqual([
      "coin_flip",
      "get_time",
    ]);
    expect(manager.listConnected()).toEqual(["mock"]);
  });

  it("returns the connected client via getClient()", async () => {
    manager = createMcpManager();
    await manager.start("mock", mockStdioConnection());
    const client = manager.getClient("mock");
    expect(client).toBeDefined();
    const result = await client?.callTool("coin_flip", {});
    expect(result?.isError).toBe(false);
  });

  it("returns undefined for unknown server name", async () => {
    manager = createMcpManager();
    expect(manager.getClient("unknown")).toBeUndefined();
  });

  it("stops a single server", async () => {
    manager = createMcpManager();
    await manager.start("mock", mockStdioConnection());
    await manager.stop("mock");
    expect(manager.listConnected()).toEqual([]);
    expect(manager.getClient("mock")).toBeUndefined();
  });

  it("stop is a no-op for unknown server", async () => {
    manager = createMcpManager();
    await expect(manager.stop("unknown")).resolves.not.toThrow();
  });

  it("startAll connects multiple servers in parallel", async () => {
    manager = createMcpManager();
    const result = await manager.startAll({
      first: mockStdioConnection(),
      second: mockStdioConnection(),
    });
    expect(result.failed).toEqual([]);
    expect(result.started.map((s) => s.name).sort()).toEqual([
      "first",
      "second",
    ]);
    expect(manager.listConnected().sort()).toEqual(["first", "second"]);
  });

  it("startAll skips disabled servers", async () => {
    manager = createMcpManager();
    const result = await manager.startAll({
      enabled: mockStdioConnection(),
      disabled: { ...mockStdioConnection(), enabled: false },
    });
    expect(result.started.map((s) => s.name)).toEqual(["enabled"]);
    expect(result.failed).toEqual([]);
  });

  it("startAll reports failures without throwing", async () => {
    manager = createMcpManager();
    const result = await manager.startAll({
      good: mockStdioConnection(),
      broken: {
        transport: "stdio",
        command: "node",
        args: ["/path/that/does/not/exist.mjs"],
        enabled: true,
      },
    });
    expect(result.started.map((s) => s.name)).toEqual(["good"]);
    expect(result.failed.map((f) => f.name)).toEqual(["broken"]);
    expect(result.failed[0].error).toBeTruthy();
  });

  it("stopAll disconnects every connected server", async () => {
    manager = createMcpManager();
    await manager.startAll({
      a: mockStdioConnection(),
      b: mockStdioConnection(),
    });
    await manager.stopAll();
    expect(manager.listConnected()).toEqual([]);
  });

  it("coerces non-Error rejections to a string in the failed list", async () => {
    // Use the client factory injection point to force a connect() that
    // throws a plain string instead of an Error instance.
    const fakeClient: McpClient = {
      connect: vi.fn(async () => {
        // Intentionally throwing a non-Error to exercise the stringification
        // path in the manager's startAll error handler.
        throw "plain string rejection";
      }),
      listTools: vi.fn(async () => []),
      callTool: vi.fn(async () => ({ text: "", isError: false })),
      disconnect: vi.fn(async () => {}),
    };
    manager = createMcpManager(async () => fakeClient);
    const result = await manager.startAll({
      stringy: mockStdioConnection(),
    });
    expect(result.started).toEqual([]);
    expect(result.failed).toEqual([
      { name: "stringy", error: "plain string rejection" },
    ]);
  });
});
