import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpTransport } from "./http-transport.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sseResponse(events: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(event));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

/** Creates an SSE response where the raw string is split into separate chunks at given byte offsets. */
function chunkedSseResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("HttpTransport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("throws if started twice", () => {
    const transport = new HttpTransport("https://mcp.example.com");
    transport.start();
    expect(() => transport.start()).toThrow("Transport already started");
    transport.close();
  });

  it("throws on request if not started", async () => {
    const transport = new HttpTransport("https://mcp.example.com");
    await expect(
      transport.request({ jsonrpc: "2.0", id: 1, method: "test" }),
    ).rejects.toThrow("Transport is not running");
  });

  it("throws on notify if not started", () => {
    const transport = new HttpTransport("https://mcp.example.com");
    expect(() => transport.notify({ jsonrpc: "2.0", method: "test" })).toThrow(
      "Transport is not running",
    );
  });

  it("sends POST request with correct headers and body", async () => {
    const transport = new HttpTransport("https://mcp.example.com", {
      Authorization: "Bearer token123",
    });
    transport.start();

    mockFetch.mockResolvedValueOnce(
      jsonResponse({ jsonrpc: "2.0", id: 1, result: { ok: true } }),
    );

    await transport.request({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26" },
    });

    expect(mockFetch).toHaveBeenCalledWith("https://mcp.example.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: "Bearer token123",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-03-26" },
      }),
    });

    transport.close();
  });

  it("returns JSON response", async () => {
    const transport = new HttpTransport("https://mcp.example.com");
    transport.start();

    mockFetch.mockResolvedValueOnce(
      jsonResponse({ jsonrpc: "2.0", id: 1, result: { tools: [] } }),
    );

    const response = await transport.request({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
    });

    expect(response.result).toEqual({ tools: [] });
    transport.close();
  });

  it("throws on non-ok HTTP response", async () => {
    const transport = new HttpTransport("https://mcp.example.com");
    transport.start();

    mockFetch.mockResolvedValueOnce(
      new Response("Not Found", { status: 404, statusText: "Not Found" }),
    );

    await expect(
      transport.request({ jsonrpc: "2.0", id: 1, method: "test" }),
    ).rejects.toThrow("MCP HTTP request failed: 404 Not Found");

    transport.close();
  });

  it("parses SSE response and returns matching JSON-RPC response", async () => {
    const transport = new HttpTransport("https://mcp.example.com");
    transport.start();

    const responseData = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result: { content: [{ type: "text", text: "hello" }] },
    });

    mockFetch.mockResolvedValueOnce(sseResponse([`data: ${responseData}\n\n`]));

    const response = await transport.request({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "test" },
    });

    expect(response.result).toEqual({
      content: [{ type: "text", text: "hello" }],
    });

    transport.close();
  });

  it("dispatches notifications from SSE stream", async () => {
    const transport = new HttpTransport("https://mcp.example.com");
    const handler = vi.fn();
    transport.start();
    transport.onNotification(handler);

    const notification = JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/tools/list_changed",
    });
    const response = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result: { ok: true },
    });

    mockFetch.mockResolvedValueOnce(
      sseResponse([`data: ${notification}\n\n`, `data: ${response}\n\n`]),
    );

    await transport.request({
      jsonrpc: "2.0",
      id: 1,
      method: "test",
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "notifications/tools/list_changed",
      }),
    );

    transport.close();
  });

  it("throws when SSE stream ends without response", async () => {
    const transport = new HttpTransport("https://mcp.example.com");
    transport.start();

    mockFetch.mockResolvedValueOnce(sseResponse([]));

    await expect(
      transport.request({ jsonrpc: "2.0", id: 1, method: "test" }),
    ).rejects.toThrow("MCP HTTP SSE stream ended without a response");

    transport.close();
  });

  it("sends notification via POST fire-and-forget", async () => {
    const transport = new HttpTransport("https://mcp.example.com");
    transport.start();

    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

    transport.notify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });

    // Allow microtask to run
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockFetch).toHaveBeenCalledWith("https://mcp.example.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/initialized",
      }),
    });

    transport.close();
  });

  it("handles SSE event split across multiple chunks", async () => {
    const transport = new HttpTransport("https://mcp.example.com");
    transport.start();

    const responseData = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result: { value: "chunked" },
    });

    // Split the SSE event in the middle of the data line
    const fullEvent = `data: ${responseData}\n\n`;
    const mid = Math.floor(fullEvent.length / 2);

    mockFetch.mockResolvedValueOnce(
      chunkedSseResponse([fullEvent.slice(0, mid), fullEvent.slice(mid)]),
    );

    const response = await transport.request({
      jsonrpc: "2.0",
      id: 1,
      method: "test",
    });

    expect(response.result).toEqual({ value: "chunked" });
    transport.close();
  });

  it("handles SSE event split on double-newline boundary", async () => {
    const transport = new HttpTransport("https://mcp.example.com");
    transport.start();

    const responseData = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result: "ok",
    });

    // First chunk has data line and first newline, second chunk has second newline
    mockFetch.mockResolvedValueOnce(
      chunkedSseResponse([`data: ${responseData}\n`, "\n"]),
    );

    const response = await transport.request({
      jsonrpc: "2.0",
      id: 1,
      method: "test",
    });

    expect(response.result).toBe("ok");
    transport.close();
  });

  it("handles multiple SSE events across many small chunks", async () => {
    const transport = new HttpTransport("https://mcp.example.com");
    const handler = vi.fn();
    transport.start();
    transport.onNotification(handler);

    const notification = JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/progress",
    });
    const responseData = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result: { done: true },
    });

    // Split across 4 tiny chunks: notification event split in two, then response event split in two
    const notifEvent = `data: ${notification}\n\n`;
    const respEvent = `data: ${responseData}\n\n`;

    mockFetch.mockResolvedValueOnce(
      chunkedSseResponse([
        notifEvent.slice(0, 10),
        notifEvent.slice(10),
        respEvent.slice(0, 15),
        respEvent.slice(15),
      ]),
    );

    const response = await transport.request({
      jsonrpc: "2.0",
      id: 1,
      method: "test",
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ method: "notifications/progress" }),
    );
    expect(response.result).toEqual({ done: true });
    transport.close();
  });

  it("skips malformed SSE data lines", async () => {
    const transport = new HttpTransport("https://mcp.example.com");
    transport.start();

    const response = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result: "ok",
    });

    mockFetch.mockResolvedValueOnce(
      sseResponse(["data: not valid json\n\n", `data: ${response}\n\n`]),
    );

    const result = await transport.request({
      jsonrpc: "2.0",
      id: 1,
      method: "test",
    });

    expect(result.result).toBe("ok");
    transport.close();
  });
});
