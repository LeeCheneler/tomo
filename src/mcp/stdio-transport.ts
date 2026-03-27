import { type ChildProcess, spawn } from "node:child_process";
import type {
  JsonRpcNotification,
  JsonRpcRequest,
  JsonRpcResponse,
} from "./types.js";

type Message = JsonRpcResponse | JsonRpcNotification;

/**
 * Stdio transport for MCP servers. Spawns a child process and communicates
 * via newline-delimited JSON over stdin/stdout.
 */
export class StdioTransport {
  private process: ChildProcess | null = null;
  private buffer = "";
  private responseHandlers = new Map<
    number,
    {
      resolve: (response: JsonRpcResponse) => void;
      reject: (error: Error) => void;
    }
  >();
  private notificationHandler:
    | ((notification: JsonRpcNotification) => void)
    | null = null;
  private closed = false;

  constructor(
    private command: string,
    private args: string[] = [],
    private env?: Record<string, string>,
  ) {}

  /** Spawn the child process and begin listening for messages. */
  start(): void {
    if (this.process) {
      throw new Error("Transport already started");
    }

    this.process = spawn(this.command, this.args, {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env, ...this.env },
    });

    this.process.stdout?.on("data", (chunk: Buffer) => {
      this.buffer += chunk.toString();
      this.processBuffer();
    });

    this.process.on("close", () => {
      this.closed = true;
      for (const handler of this.responseHandlers.values()) {
        handler.reject(new Error("MCP server process exited"));
      }
      this.responseHandlers.clear();
    });

    this.process.on("error", (err) => {
      this.closed = true;
      for (const handler of this.responseHandlers.values()) {
        handler.reject(err);
      }
      this.responseHandlers.clear();
    });
  }

  /** Send a JSON-RPC request and wait for the matching response. */
  request(message: JsonRpcRequest): Promise<JsonRpcResponse> {
    if (this.closed || !this.process) {
      return Promise.reject(new Error("Transport is not running"));
    }

    return new Promise<JsonRpcResponse>((resolve, reject) => {
      this.responseHandlers.set(message.id, { resolve, reject });
      this.write(message);
    });
  }

  /** Send a JSON-RPC notification (fire-and-forget). */
  notify(notification: JsonRpcNotification): void {
    if (this.closed || !this.process) {
      throw new Error("Transport is not running");
    }
    this.write(notification);
  }

  /** Register a handler for server-initiated notifications. */
  onNotification(handler: (notification: JsonRpcNotification) => void): void {
    this.notificationHandler = handler;
  }

  /** Kill the child process and clean up. */
  close(): void {
    this.closed = true;
    if (this.process) {
      this.process.kill("SIGTERM");
      this.process = null;
    }
    for (const handler of this.responseHandlers.values()) {
      handler.reject(new Error("Transport closed"));
    }
    this.responseHandlers.clear();
  }

  private write(message: JsonRpcRequest | JsonRpcNotification): void {
    this.process?.stdin?.write(`${JSON.stringify(message)}\n`);
  }

  private processBuffer(): void {
    const lines = this.buffer.split("\n");
    // Keep the last incomplete line in the buffer
    this.buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let parsed: Message;
      try {
        parsed = JSON.parse(trimmed) as Message;
      } catch {
        continue;
      }

      if ("id" in parsed && typeof parsed.id === "number") {
        const handler = this.responseHandlers.get(parsed.id);
        if (handler) {
          this.responseHandlers.delete(parsed.id);
          handler.resolve(parsed as JsonRpcResponse);
        }
      } else if ("method" in parsed) {
        this.notificationHandler?.(parsed as JsonRpcNotification);
      }
    }
  }
}
