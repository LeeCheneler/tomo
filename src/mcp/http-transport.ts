import type {
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
  McpTransport,
} from "./types.js";

/**
 * HTTP transport for remote MCP servers. Sends JSON-RPC messages via POST
 * and receives server-initiated notifications via SSE.
 */
export class HttpTransport implements McpTransport {
  private notificationHandler:
    | ((notification: JsonRpcNotification) => void)
    | null = null;
  private abortController: AbortController | null = null;
  private started = false;

  constructor(
    private url: string,
    private headers?: Record<string, string>,
  ) {}

  /** Mark the transport as started. Optionally opens an SSE connection for server notifications. */
  start(): void {
    if (this.started) {
      throw new Error("Transport already started");
    }
    this.started = true;
  }

  /** Send a JSON-RPC request via POST and return the response. */
  async request(message: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (!this.started) {
      throw new Error("Transport is not running");
    }

    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...this.headers,
      },
      body: JSON.stringify(message),
    });

    if (!response.ok) {
      throw new Error(
        `MCP HTTP request failed: ${response.status} ${response.statusText}`,
      );
    }

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
      headers: {
        "Content-Type": "application/json",
        ...this.headers,
      },
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
          const dataLine = event
            .split("\n")
            .find((line) => line.startsWith("data: "));
          if (!dataLine) continue;

          const data = dataLine.slice(6);
          let parsed: JsonRpcResponse | JsonRpcNotification;
          try {
            parsed = JSON.parse(data);
          } catch {
            continue;
          }

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
