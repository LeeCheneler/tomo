import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import type { McpClient } from "./client";
import {
  createHttpMcpClient,
  createMcpClient,
  createStdioMcpClient,
  flattenContent,
} from "./client";

const STDIO_MOCK = resolve(__dirname, "../../mock-mcps/stdio.mjs");
const HTTP_MOCK = resolve(__dirname, "../../mock-mcps/http.mjs");
/** Non-default port to avoid colliding with a dev mock instance. */
const HTTP_PORT = 9878;
const HTTP_URL = `http://localhost:${HTTP_PORT}`;

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

describe("createHttpMcpClient", () => {
  let server: ChildProcess | null = null;
  let client: McpClient | null = null;
  let authDataDir: string;

  beforeAll(async () => {
    server = spawn("node", [HTTP_MOCK], {
      env: { ...process.env, PORT: String(HTTP_PORT) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    // Wait for the "listening" line on stdout before running tests.
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error("mock http server did not start in time")),
        5000,
      );
      server?.stdout?.on("data", (chunk: Buffer) => {
        if (chunk.toString().includes("listening")) {
          clearTimeout(timeout);
          resolve();
        }
      });
      server?.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  });

  afterAll(async () => {
    if (server && !server.killed) {
      server.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        server?.on("exit", () => resolve());
      });
    }
  });

  beforeEach(() => {
    // Isolate each test's persisted OAuth state (including the bound
    // loopback port) so they don't leak across runs or into ~/.tomo.
    authDataDir = mkdtempSync(resolve(tmpdir(), "tomo-mcp-client-"));
  });

  afterEach(async () => {
    if (client) {
      await client.disconnect();
      client = null;
    }
    rmSync(authDataDir, { recursive: true, force: true });
  });

  /** Connects an http client to the mock server. */
  async function connectMock(
    headers?: Record<string, string>,
  ): Promise<McpClient> {
    const c = await createHttpMcpClient({
      serverName: "mock",
      url: HTTP_URL,
      headers,
      authDataDir,
    });
    await c.connect();
    return c;
  }

  it("connects to the mock http server and lists tools", async () => {
    client = await connectMock();
    const tools = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(["get_weather", "random_number"]);
  });

  it("returns descriptions and inputSchemas for each tool", async () => {
    client = await connectMock();
    const tools = await client.listTools();
    const getWeather = tools.find((t) => t.name === "get_weather");
    expect(getWeather).toBeDefined();
    expect(getWeather?.description).toContain("weather");
    expect(getWeather?.inputSchema).toMatchObject({
      type: "object",
      required: ["city"],
    });
  });

  it("calls a tool and returns the text content", async () => {
    client = await connectMock();
    const result = await client.callTool("get_weather", { city: "London" });
    expect(result.isError).toBe(false);
    expect(result.text).toContain("London");
    expect(result.text).toContain("14°C");
  });

  it("passes arguments through to the tool", async () => {
    client = await connectMock();
    const result = await client.callTool("random_number", {
      min: 100,
      max: 100,
    });
    expect(result.isError).toBe(false);
    expect(result.text).toBe("100");
  });

  it("accepts custom headers without crashing", async () => {
    client = await connectMock({ Authorization: "Bearer test-token" });
    const tools = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
  });

  it("disconnects cleanly", async () => {
    const c = await connectMock();
    await c.disconnect();
    await expect(c.disconnect()).resolves.not.toThrow();
  });

  it("listTools throws when called before connect", async () => {
    const c = await createHttpMcpClient({
      serverName: "mock-not-connected",
      url: HTTP_URL,
      authDataDir,
    });
    try {
      await expect(c.listTools()).rejects.toThrow(/not connected/);
    } finally {
      await c.disconnect();
    }
  });

  it("callTool throws when called before connect", async () => {
    const c = await createHttpMcpClient({
      serverName: "mock-not-connected",
      url: HTTP_URL,
      authDataDir,
    });
    try {
      await expect(c.callTool("x", {})).rejects.toThrow(/not connected/);
    } finally {
      await c.disconnect();
    }
  });
});

describe("createMcpClient", () => {
  let authDataDir: string;

  beforeEach(() => {
    authDataDir = mkdtempSync(resolve(tmpdir(), "tomo-mcp-dispatch-"));
  });

  afterEach(() => {
    rmSync(authDataDir, { recursive: true, force: true });
  });

  it("builds a stdio client from a stdio connection", async () => {
    const client = await createMcpClient(
      "mock",
      {
        transport: "stdio",
        command: "node",
        args: [],
        enabled: true,
      },
      { authDataDir },
    );
    expect(client).toBeDefined();
  });

  it("builds an http client from an http connection", async () => {
    const http = await createMcpClient(
      "dispatch-http",
      {
        transport: "http",
        url: "https://example.com/mcp",
        enabled: true,
      },
      { authDataDir },
    );
    expect(http).toBeDefined();
    await http.disconnect();
  });
});
