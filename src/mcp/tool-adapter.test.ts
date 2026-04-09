import { describe, expect, it, vi } from "vitest";
import { mockToolContext } from "../test-utils/stub-context";
import type { McpClient, McpToolDefinition } from "./client";
import type { McpManager } from "./manager";
import {
  createMcpTool,
  encodeMcpToolName,
  isMcpToolName,
  MCP_TOOL_PREFIX,
} from "./tool-adapter";

const sampleDef: McpToolDefinition = {
  name: "get_time",
  description: "Returns the current time",
  inputSchema: {
    type: "object",
    properties: { timezone: { type: "string" } },
    required: ["timezone"],
  },
};

/** Builds a fake McpManager with one fake client for the given server name. */
function fakeManager(
  serverName: string,
  client: Partial<McpClient>,
): McpManager {
  const fullClient: McpClient = {
    connect: vi.fn(async () => {}),
    listTools: vi.fn(async () => []),
    callTool: vi.fn(async () => ({ text: "", isError: false })),
    disconnect: vi.fn(async () => {}),
    ...client,
  };
  return {
    startAll: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    stopAll: vi.fn(),
    getClient: (name: string) => (name === serverName ? fullClient : undefined),
    listConnected: () => [serverName],
  };
}

describe("encodeMcpToolName", () => {
  it("encodes server and tool name with the mcp__ prefix", () => {
    expect(encodeMcpToolName("mock", "get_time")).toBe("mcp__mock__get_time");
  });
});

describe("isMcpToolName", () => {
  it("returns true for namespaced tool names", () => {
    expect(isMcpToolName("mcp__server__tool")).toBe(true);
  });

  it("returns false for non-namespaced tool names", () => {
    expect(isMcpToolName("read_file")).toBe(false);
    expect(isMcpToolName("get_time")).toBe(false);
  });

  it("matches the exported prefix constant", () => {
    expect(MCP_TOOL_PREFIX).toBe("mcp__");
  });
});

describe("createMcpTool", () => {
  it("uses the namespaced name and forwards parameters", () => {
    const manager = fakeManager("mock", {});
    const tool = createMcpTool("mock", sampleDef, manager);
    expect(tool.name).toBe("mcp__mock__get_time");
    expect(tool.displayName).toBe("mock/get_time");
    expect(tool.description).toBe("Returns the current time");
    expect(tool.parameters).toEqual(sampleDef.inputSchema);
  });

  it("falls back to a generic description when none is provided", () => {
    const manager = fakeManager("mock", {});
    const tool = createMcpTool(
      "mock",
      { name: "x", inputSchema: { type: "object" } },
      manager,
    );
    expect(tool.description).toBe("MCP tool from mock");
  });

  it("formats args as key=value pairs for the chat summary", () => {
    const manager = fakeManager("mock", {});
    const tool = createMcpTool("mock", sampleDef, manager);
    expect(tool.formatCall({ timezone: "UTC", retries: 3 })).toBe(
      "timezone=UTC, retries=3",
    );
  });

  it("returns an empty summary when there are no args", () => {
    const manager = fakeManager("mock", {});
    const tool = createMcpTool("mock", sampleDef, manager);
    expect(tool.formatCall({})).toBe("");
  });

  it("truncates long string values in the summary", () => {
    const manager = fakeManager("mock", {});
    const tool = createMcpTool("mock", sampleDef, manager);
    const long = "a".repeat(60);
    const summary = tool.formatCall({ text: long });
    expect(summary).toContain("...");
    expect(summary.length).toBeLessThan(`text=${long}`.length);
  });

  it("renders null and undefined arg values", () => {
    const manager = fakeManager("mock", {});
    const tool = createMcpTool("mock", sampleDef, manager);
    expect(tool.formatCall({ a: null, b: undefined })).toBe(
      "a=null, b=undefined",
    );
  });

  it("renders boolean arg values", () => {
    const manager = fakeManager("mock", {});
    const tool = createMcpTool("mock", sampleDef, manager);
    expect(tool.formatCall({ force: true, dry: false })).toBe(
      "force=true, dry=false",
    );
  });

  it("JSON-stringifies object and array arg values", () => {
    const manager = fakeManager("mock", {});
    const tool = createMcpTool("mock", sampleDef, manager);
    expect(tool.formatCall({ tags: ["a", "b"], opts: { x: 1 } })).toBe(
      'tags=["a","b"], opts={"x":1}',
    );
  });

  it("returns an error when args are not a record", async () => {
    const callTool = vi.fn();
    const manager = fakeManager("mock", { callTool });
    const tool = createMcpTool("mock", sampleDef, manager);
    const result = await tool.execute([1, 2, 3], mockToolContext());
    expect(result.status).toBe("error");
    expect(result.output).toContain("Invalid arguments");
    expect(callTool).not.toHaveBeenCalled();
  });

  it("dispatches to the manager's client and returns ok on success", async () => {
    const callTool = vi.fn(async () => ({ text: "12:00 UTC", isError: false }));
    const manager = fakeManager("mock", { callTool });
    const tool = createMcpTool("mock", sampleDef, manager);
    const result = await tool.execute({ timezone: "UTC" }, mockToolContext());
    expect(callTool).toHaveBeenCalledWith(
      "get_time",
      { timezone: "UTC" },
      expect.any(AbortSignal),
    );
    expect(result.status).toBe("ok");
    expect(result.output).toBe("12:00 UTC");
  });

  it("returns an error when the manager has no client for the server", async () => {
    const manager: McpManager = {
      startAll: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      stopAll: vi.fn(),
      getClient: () => undefined,
      listConnected: () => [],
    };
    const tool = createMcpTool("mock", sampleDef, manager);
    const result = await tool.execute({ timezone: "UTC" }, mockToolContext());
    expect(result.status).toBe("error");
    expect(result.output).toContain("not connected");
  });

  it("returns an error when the server flags the result as an error", async () => {
    const callTool = vi.fn(async () => ({
      text: "Unknown timezone",
      isError: true,
    }));
    const manager = fakeManager("mock", { callTool });
    const tool = createMcpTool("mock", sampleDef, manager);
    const result = await tool.execute(
      { timezone: "Bad/Zone" },
      mockToolContext(),
    );
    expect(result.status).toBe("error");
    expect(result.output).toBe("Unknown timezone");
  });

  it("returns an error when the underlying call throws", async () => {
    const callTool = vi.fn(async () => {
      throw new Error("connection broken");
    });
    const manager = fakeManager("mock", { callTool });
    const tool = createMcpTool("mock", sampleDef, manager);
    const result = await tool.execute({ timezone: "UTC" }, mockToolContext());
    expect(result.status).toBe("error");
    expect(result.output).toBe("connection broken");
  });

  it("stringifies non-Error throws from the underlying call", async () => {
    const callTool = vi.fn(async () => {
      // Intentionally throwing a non-Error to exercise the stringification
      // path in the tool adapter's catch handler.
      throw "plain string rejection";
    });
    const manager = fakeManager("mock", { callTool });
    const tool = createMcpTool("mock", sampleDef, manager);
    const result = await tool.execute({ timezone: "UTC" }, mockToolContext());
    expect(result.status).toBe("error");
    expect(result.output).toBe("plain string rejection");
  });

  it("returns an Aborted error when the signal is already aborted", async () => {
    const callTool = vi.fn();
    const manager = fakeManager("mock", { callTool });
    const tool = createMcpTool("mock", sampleDef, manager);
    const controller = new AbortController();
    controller.abort();
    const result = await tool.execute(
      { timezone: "UTC" },
      mockToolContext({ signal: controller.signal }),
    );
    expect(result.status).toBe("error");
    expect(result.output).toBe("Aborted");
    expect(callTool).not.toHaveBeenCalled();
  });
});
