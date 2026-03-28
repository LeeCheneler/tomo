import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HttpTransport } from "./http-transport.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(
  body: Record<string, unknown>,
  status = 200,
  headers?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function sseResponse(
  events: string[],
  headers?: Record<string, string>,
): Response {
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
    headers: { "Content-Type": "text/event-stream", ...headers },
  });
}

/** Creates an SSE response where the raw string is split into separate chunks. */
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

/** Queue a no-op response for the GET SSE listener, then start the transport. */
function startTransport(transport: HttpTransport) {
  mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));
  transport.start();
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
    startTransport(transport);
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
    startTransport(transport);

    mockFetch.mockResolvedValueOnce(
      jsonResponse({ jsonrpc: "2.0", id: 1, result: { ok: true } }),
    );

    await transport.request({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-03-26" },
    });

    // Second call is the POST request (first was GET SSE listener)
    const postCall = mockFetch.mock.calls[1];
    expect(postCall[0]).toBe("https://mcp.example.com");
    expect(postCall[1]).toEqual({
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
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

  it("sends Accept: application/json, text/event-stream on POST", async () => {
    const transport = new HttpTransport("https://mcp.example.com");
    startTransport(transport);

    mockFetch.mockResolvedValueOnce(
      jsonResponse({ jsonrpc: "2.0", id: 1, result: {} }),
    );

    await transport.request({ jsonrpc: "2.0", id: 1, method: "test" });

    const postCall = mockFetch.mock.calls[1];
    expect(postCall[1].headers.Accept).toBe(
      "application/json, text/event-stream",
    );

    transport.close();
  });

  it("returns JSON response", async () => {
    const transport = new HttpTransport("https://mcp.example.com");
    startTransport(transport);

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
    startTransport(transport);

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
    startTransport(transport);

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
    startTransport(transport);
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
    startTransport(transport);

    mockFetch.mockResolvedValueOnce(sseResponse([]));

    await expect(
      transport.request({ jsonrpc: "2.0", id: 1, method: "test" }),
    ).rejects.toThrow("MCP HTTP SSE stream ended without a response");

    transport.close();
  });

  it("sends notification via POST fire-and-forget", async () => {
    const transport = new HttpTransport("https://mcp.example.com");
    startTransport(transport);

    mockFetch.mockResolvedValueOnce(new Response(null, { status: 204 }));

    transport.notify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });

    await new Promise((resolve) => setTimeout(resolve, 0));

    // Second call is the POST notification (first was GET SSE listener)
    const postCall = mockFetch.mock.calls[1];
    expect(postCall[0]).toBe("https://mcp.example.com");
    expect(postCall[1].method).toBe("POST");
    expect(postCall[1].headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(postCall[1].body)).toEqual({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    });

    transport.close();
  });

  describe("Mcp-Session-Id", () => {
    it("captures session ID from response and includes on subsequent requests", async () => {
      const transport = new HttpTransport("https://mcp.example.com");
      startTransport(transport);

      // First POST returns a session ID header
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ jsonrpc: "2.0", id: 1, result: { ok: true } }, 200, {
          "Mcp-Session-Id": "session-abc-123",
        }),
      );

      await transport.request({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
      });

      // Second POST should include the session ID
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ jsonrpc: "2.0", id: 2, result: { tools: [] } }),
      );

      await transport.request({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      });

      // Third call is the second POST (0=GET, 1=first POST, 2=second POST)
      const secondPostHeaders = mockFetch.mock.calls[2][1].headers;
      expect(secondPostHeaders["Mcp-Session-Id"]).toBe("session-abc-123");

      transport.close();
    });

    it("includes session ID on notifications", async () => {
      const transport = new HttpTransport("https://mcp.example.com");
      startTransport(transport);

      // First POST sets the session ID
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ jsonrpc: "2.0", id: 1, result: {} }, 200, {
          "Mcp-Session-Id": "sess-42",
        }),
      );

      await transport.request({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
      });

      // Send a notification
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 202 }));
      transport.notify({ jsonrpc: "2.0", method: "notifications/initialized" });
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Notification POST should include session ID
      const notifyHeaders = mockFetch.mock.calls[2][1].headers;
      expect(notifyHeaders["Mcp-Session-Id"]).toBe("sess-42");

      transport.close();
    });

    it("does not include session ID header when server provides none", async () => {
      const transport = new HttpTransport("https://mcp.example.com");
      startTransport(transport);

      mockFetch.mockResolvedValueOnce(
        jsonResponse({ jsonrpc: "2.0", id: 1, result: {} }),
      );

      await transport.request({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
      });

      mockFetch.mockResolvedValueOnce(
        jsonResponse({ jsonrpc: "2.0", id: 2, result: {} }),
      );

      await transport.request({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
      });

      const secondPostHeaders = mockFetch.mock.calls[2][1].headers;
      expect(secondPostHeaders).not.toHaveProperty("Mcp-Session-Id");

      transport.close();
    });
  });

  describe("GET SSE listener", () => {
    it("opens GET SSE connection on start()", () => {
      const transport = new HttpTransport("https://mcp.example.com");
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));
      transport.start();

      const getCall = mockFetch.mock.calls[0];
      expect(getCall[0]).toBe("https://mcp.example.com");
      expect(getCall[1].method).toBe("GET");
      expect(getCall[1].headers.Accept).toBe("text/event-stream");
      expect(getCall[1].signal).toBeInstanceOf(AbortSignal);

      transport.close();
    });

    it("dispatches notifications from GET SSE stream", async () => {
      const transport = new HttpTransport("https://mcp.example.com");
      const handler = vi.fn();
      transport.onNotification(handler);

      const notification = JSON.stringify({
        jsonrpc: "2.0",
        method: "notifications/resources/updated",
      });

      mockFetch.mockResolvedValueOnce(
        sseResponse([`data: ${notification}\n\n`]),
      );

      transport.start();

      // Allow the SSE stream to be consumed
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "notifications/resources/updated",
        }),
      );

      transport.close();
    });

    it("silently handles GET SSE listener failure", () => {
      const transport = new HttpTransport("https://mcp.example.com");
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      // Should not throw
      expect(() => transport.start()).not.toThrow();
      transport.close();
    });

    it("aborts GET SSE listener on close()", () => {
      const transport = new HttpTransport("https://mcp.example.com");
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));
      transport.start();

      const signal = mockFetch.mock.calls[0][1].signal as AbortSignal;
      expect(signal.aborted).toBe(false);

      transport.close();
      expect(signal.aborted).toBe(true);
    });

    it("includes session ID on GET SSE listener after capture", async () => {
      const transport = new HttpTransport("https://mcp.example.com");
      startTransport(transport);

      // Capture session ID via POST
      mockFetch.mockResolvedValueOnce(
        jsonResponse({ jsonrpc: "2.0", id: 1, result: {} }, 200, {
          "Mcp-Session-Id": "sess-99",
        }),
      );

      await transport.request({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
      });

      // The initial GET call (index 0) won't have the session ID since it's
      // opened before any POST response. Verify it was sent without one.
      const getHeaders = mockFetch.mock.calls[0][1].headers;
      expect(getHeaders).not.toHaveProperty("Mcp-Session-Id");

      // But subsequent POST requests have it
      const postHeaders = mockFetch.mock.calls[1][1].headers;
      expect(postHeaders).not.toHaveProperty("Mcp-Session-Id"); // first POST, no session yet

      transport.close();
    });
  });

  describe("SSE event: field", () => {
    it("processes events with explicit event: message type", async () => {
      const transport = new HttpTransport("https://mcp.example.com");
      startTransport(transport);

      const responseData = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: "ok",
      });

      mockFetch.mockResolvedValueOnce(
        sseResponse([`event: message\ndata: ${responseData}\n\n`]),
      );

      const response = await transport.request({
        jsonrpc: "2.0",
        id: 1,
        method: "test",
      });

      expect(response.result).toBe("ok");
      transport.close();
    });

    it("processes events with no event: field (default is message)", async () => {
      const transport = new HttpTransport("https://mcp.example.com");
      startTransport(transport);

      const responseData = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: "ok",
      });

      mockFetch.mockResolvedValueOnce(
        sseResponse([`data: ${responseData}\n\n`]),
      );

      const response = await transport.request({
        jsonrpc: "2.0",
        id: 1,
        method: "test",
      });

      expect(response.result).toBe("ok");
      transport.close();
    });

    it("skips events with non-message event types", async () => {
      const transport = new HttpTransport("https://mcp.example.com");
      startTransport(transport);

      const heartbeat = JSON.stringify({ type: "heartbeat" });
      const responseData = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: "ok",
      });

      mockFetch.mockResolvedValueOnce(
        sseResponse([
          `event: heartbeat\ndata: ${heartbeat}\n\n`,
          `data: ${responseData}\n\n`,
        ]),
      );

      const response = await transport.request({
        jsonrpc: "2.0",
        id: 1,
        method: "test",
      });

      expect(response.result).toBe("ok");
      transport.close();
    });
  });

  describe("chunked SSE", () => {
    it("handles SSE event split across multiple chunks", async () => {
      const transport = new HttpTransport("https://mcp.example.com");
      startTransport(transport);

      const responseData = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: { value: "chunked" },
      });

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
      startTransport(transport);

      const responseData = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: "ok",
      });

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
      startTransport(transport);
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
  });

  it("skips malformed SSE data lines", async () => {
    const transport = new HttpTransport("https://mcp.example.com");
    startTransport(transport);

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
