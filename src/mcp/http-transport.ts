import type {
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
  McpTransport,
} from "./types.js";

/**
 * HTTP transport for remote MCP servers aligned with the MCP Streamable HTTP
 * specification (2025-03-26+). Sends JSON-RPC messages via POST, captures
 * Mcp-Session-Id for stateful servers, and opens a long-lived GET SSE
 * connection for server-initiated notifications.
 */
export class HttpTransport implements McpTransport {
  private notificationHandler:
    | ((notification: JsonRpcNotification) => void)
    | null = null;
  private abortController: AbortController | null = null;
  private started = false;
  private sessionId: string | null = null;

  constructor(
    private url: string,
    private headers?: Record<string, string>,
  ) {}

  /** Build the shared set of headers included on every outgoing request. */
  private getRequestHeaders(
    extra?: Record<string, string>,
  ): Record<string, string> {
    return {
      "Content-Type": "application/json",
      ...this.headers,
      ...(this.sessionId ? { "Mcp-Session-Id": this.sessionId } : {}),
      ...extra,
    };
  }

  /** Capture Mcp-Session-Id from a response if the server provides one. */
  private captureSessionId(response: Response): void {
    const id = response.headers.get("mcp-session-id");
    if (id) {
      this.sessionId = id;
    }
  }

  /**
   * Start the transport and open a long-lived GET SSE connection for
   * server-initiated notifications (tool list changes, resource updates, etc.).
   */
  start(): void {
    if (this.started) {
      throw new Error("Transport already started");
    }
    this.started = true;
    this.openSseListener();
  }

  /** Send a JSON-RPC request via POST and return the response. */
  async request(message: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.started) {
      throw new Error("Transport is not running");
    }

    const response = await fetch(this.url, {
      method: "POST",
      headers: this.getRequestHeaders({
        Accept: "application/json, text/event-stream",
      }),
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(
        `MCP HTTP request failed: ${response.status} ${response.statusText}`,
      );
    }

    this.captureSessionId(response);

    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("text/event-stream")) {
      return this.parseSSEResponse(message.id, response);
    }

    return (await response.json()) as JsonRpcResponse;
  }

  /** Send a JSON-RPC notification via POST (fire-and-forget). */
  notify(notification: JsonRpcNotification): void {
    if (!this.started) {
      throw new Error("Transport is not running");
    }

    fetch(this.url, {
      method: "POST",
      headers: this.getRequestHeaders(),
      body: JSON.stringify(notification),
    }).catch(() => {
      // Notifications are fire-and-forget
    });
  }

  /** Register a handler for server-initiated notifications. */
  onNotification(handler: (notification: JsonRpcNotification) => void): void {
    this.notificationHandler = handler;
  }

  /** Close the transport and abort any open connections. */
  close(): void {
    this.started = false;
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  /**
   * Open a long-lived GET SSE connection to receive server-initiated
   * notifications. Runs in the background; errors are silently ignored
   * since the connection is best-effort.
   */
  private openSseListener(): void {
    this.abortController = new AbortController();

    fetch(this.url, {
      method: "GET",
      headers: this.getRequestHeaders({
        Accept: "text/event-stream",
      }),
      signal: this.abortController.signal,
    })
      .then(async (response) => {
        if (!response.ok || !response.body) return;
        this.captureSessionId(response);
        await this.consumeSSEStream(response.body);
      })
      .catch(() => {
        // SSE listener is best-effort — server may not support GET.
      });
  }

  /** Consume an SSE stream, dispatching notifications to the handler. */
  private async consumeSSEStream(body: ReadableStream<Uint8Array>) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const parsed = this.parseSSEEvent(event);
          if (!parsed) continue;

          if ("method" in parsed && !("id" in parsed)) {
            this.notificationHandler?.(parsed as JsonRpcNotification);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Parse a single SSE event block. Returns the parsed JSON data if the event
   * is a `message` event (explicit or default), or null if it should be skipped.
   */
  private parseSSEEvent(
    event: string,
  ): JsonRpcResponse | JsonRpcNotification | null {
    const lines = event.split("\n");

    // Check event type — only process "message" events (or absent = default message).
    const eventLine = lines.find((line) => line.startsWith("event:"));
    if (eventLine) {
      const eventType = eventLine.slice(6).trim();
      if (eventType !== "message") return null;
    }

    const dataLine = lines.find((line) => line.startsWith("data: "));
    if (!dataLine) return null;

    try {
      return JSON.parse(dataLine.slice(6));
    } catch {
      return null;
    }
  }

  /** Parse an SSE response stream, extracting the JSON-RPC response matching the request id. */
  private async parseSSEResponse(
    requestId: number,
    response: Response,
  ): Promise<JsonRpcResponse> {
    const body = response.body;
    if (!body) {
      throw new Error("MCP HTTP response has no body");
    }

    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";

        for (const event of events) {
          const parsed = this.parseSSEEvent(event);
          if (!parsed) continue;

          if ("id" in parsed && parsed.id === requestId) {
            return parsed as JsonRpcResponse;
          }

          if ("method" in parsed && !("id" in parsed)) {
            this.notificationHandler?.(parsed as JsonRpcNotification);
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    throw new Error("MCP HTTP SSE stream ended without a response");
  }
}
