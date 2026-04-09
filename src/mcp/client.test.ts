import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { McpClient } from "./client";
import {
  createMcpClient,
  createStdioMcpClient,
  flattenContent,
} from "./client";

const STDIO_MOCK = resolve(__dirname, "../../mock-mcps/stdio.mjs");

describe("createStdioMcpClient", () => {
  let client: McpClient | null = null;

  afterEach(async () => {
    if (client) {
      await client.disconnect();
      client = null;
    }
  });

  /** Spawns the stdio mock and connects a client to it. */
  async function connectMock(): Promise<McpClient> {
    const c = createStdioMcpClient({
      command: "node",
      args: [STDIO_MOCK],
    });
    await c.connect();
    return c;
  }

  it("connects to the mock stdio server and lists tools", async () => {
    client = await connectMock();
    const tools = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(["coin_flip", "get_time"]);
  });

  it("returns descriptions and inputSchemas for each tool", async () => {
    client = await connectMock();
    const tools = await client.listTools();
    const getTime = tools.find((t) => t.name === "get_time");
    expect(getTime).toBeDefined();
    expect(getTime?.description).toContain("time");
    expect(getTime?.inputSchema).toMatchObject({
      type: "object",
      required: ["timezone"],
    });
  });

  it("calls a tool and returns the text content", async () => {
    client = await connectMock();
    const result = await client.callTool("coin_flip", {});
    expect(result.isError).toBe(false);
    expect(["Heads", "Tails"]).toContain(result.text);
  });

  it("passes arguments through to the tool", async () => {
    client = await connectMock();
    const result = await client.callTool("get_time", {
      timezone: "Europe/London",
    });
    expect(result.isError).toBe(false);
    expect(result.text).toContain("Europe/London");
  });

  it("returns isError true when the tool errors", async () => {
    client = await connectMock();
    const result = await client.callTool("get_time", {
      timezone: "Not/A_Real_Timezone",
    });
    expect(result.isError).toBe(true);
    expect(result.text).toContain("Unknown timezone");
  });

  it("disconnects cleanly", async () => {
    const c = await connectMock();
    await c.disconnect();
    // A second disconnect should not throw — it's idempotent enough.
    await expect(c.disconnect()).resolves.not.toThrow();
  });
});

describe("flattenContent", () => {
  it("returns empty string for an empty array", () => {
    expect(flattenContent([])).toBe("");
  });

  it("joins text blocks with newlines", () => {
    expect(
      flattenContent([
        { type: "text", text: "line one" },
        { type: "text", text: "line two" },
      ]),
    ).toBe("line one\nline two");
  });

  it("renders non-text blocks as a type placeholder", () => {
    expect(
      flattenContent([
        { type: "image", data: "base64..." },
        { type: "audio", data: "base64..." },
      ]),
    ).toBe("[image content]\n[audio content]");
  });

  it("mixes text and non-text blocks", () => {
    expect(
      flattenContent([
        { type: "text", text: "before" },
        { type: "image", data: "ignored" },
        { type: "text", text: "after" },
      ]),
    ).toBe("before\n[image content]\nafter");
  });

  it("returns empty string for blocks that don't parse", () => {
    expect(flattenContent([null, 42, "raw"])).toBe("\n\n");
  });
});

describe("createMcpClient", () => {
  it("builds a stdio client from a stdio connection", () => {
    const client = createMcpClient({
      transport: "stdio",
      command: "node",
      args: [],
      enabled: true,
    });
    expect(client).toBeDefined();
  });

  it("throws for non-stdio transports", () => {
    expect(() =>
      createMcpClient({
        transport: "http",
        url: "https://example.com/mcp",
        enabled: true,
      }),
    ).toThrow(/only stdio/);
  });
});
