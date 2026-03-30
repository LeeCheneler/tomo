import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StdioTransport } from "./stdio-transport.js";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

import { spawn } from "node:child_process";

function createMockProcess() {
  const stdout = new EventEmitter();
  const stdin = { write: vi.fn() };
  const proc = Object.assign(new EventEmitter(), {
    stdout,
    stderr: new EventEmitter(),
    stdin,
    kill: vi.fn(),
    pid: 1234,
  });
  vi.mocked(spawn).mockReturnValue(proc as never);
  return { proc, stdin, stdout };
}

function sendResponse(
  stdout: EventEmitter,
  data: Record<string, unknown>,
): void {
  stdout.emit("data", Buffer.from(`${JSON.stringify(data)}\n`));
}

describe("StdioTransport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("spawns process with correct args and env", () => {
    const { proc } = createMockProcess();
    const transport = new StdioTransport("npx", ["-y", "server"], {
      FOO: "bar",
    });
    transport.start();

    expect(spawn).toHaveBeenCalledWith("npx", ["-y", "server"], {
      stdio: ["pipe", "pipe", "pipe"],
      env: expect.objectContaining({ FOO: "bar" }),
    });

    transport.close();
    proc.removeAllListeners();
  });

  it("throws if started twice", () => {
    const { proc } = createMockProcess();
    const transport = new StdioTransport("cmd", []);
    transport.start();

    expect(() => transport.start()).toThrow("Transport already started");

    transport.close();
    proc.removeAllListeners();
  });

  it("sends request and resolves matching response", async () => {
    const { proc, stdin, stdout } = createMockProcess();
    const transport = new StdioTransport("cmd", []);
    transport.start();

    const promise = transport.request({
      jsonrpc: "2.0",
      id: 1,
      method: "test",
      params: { foo: "bar" },
    });

    expect(stdin.write).toHaveBeenCalledWith(
      `${JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "test",
        params: { foo: "bar" },
      })}\n`,
    );

    sendResponse(stdout, { jsonrpc: "2.0", id: 1, result: { ok: true } });

    const response = await promise;
    expect(response.result).toEqual({ ok: true });

    transport.close();
    proc.removeAllListeners();
  });

  it("correlates responses by id", async () => {
    const { proc, stdout } = createMockProcess();
    const transport = new StdioTransport("cmd", []);
    transport.start();

    const p1 = transport.request({ jsonrpc: "2.0", id: 1, method: "a" });
    const p2 = transport.request({ jsonrpc: "2.0", id: 2, method: "b" });

    // Respond out of order
    sendResponse(stdout, { jsonrpc: "2.0", id: 2, result: "second" });
    sendResponse(stdout, { jsonrpc: "2.0", id: 1, result: "first" });

    expect((await p1).result).toBe("first");
    expect((await p2).result).toBe("second");

    transport.close();
    proc.removeAllListeners();
  });

  it("sends notifications", () => {
    const { proc, stdin } = createMockProcess();
    const transport = new StdioTransport("cmd", []);
    transport.start();

    transport.notify({ jsonrpc: "2.0", method: "notifications/initialized" });

    expect(stdin.write).toHaveBeenCalledWith(
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) +
        "\n",
    );

    transport.close();
    proc.removeAllListeners();
  });

  it("dispatches server notifications to handler", () => {
    const { proc, stdout } = createMockProcess();
    const transport = new StdioTransport("cmd", []);
    const handler = vi.fn();
    transport.start();
    transport.onNotification(handler);

    sendResponse(stdout, {
      jsonrpc: "2.0",
      method: "notifications/tools/list_changed",
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "notifications/tools/list_changed",
      }),
    );

    transport.close();
    proc.removeAllListeners();
  });

  it("handles buffered partial lines", async () => {
    const { proc, stdout } = createMockProcess();
    const transport = new StdioTransport("cmd", []);
    transport.start();

    const promise = transport.request({
      jsonrpc: "2.0",
      id: 1,
      method: "test",
    });

    // Send response split across two chunks
    const full = JSON.stringify({ jsonrpc: "2.0", id: 1, result: "ok" });
    const mid = Math.floor(full.length / 2);
    stdout.emit("data", Buffer.from(full.slice(0, mid)));
    stdout.emit("data", Buffer.from(`${full.slice(mid)}\n`));

    const response = await promise;
    expect(response.result).toBe("ok");

    transport.close();
    proc.removeAllListeners();
  });

  it("rejects pending requests when process closes", async () => {
    const { proc } = createMockProcess();
    const transport = new StdioTransport("cmd", []);
    transport.start();

    const promise = transport.request({
      jsonrpc: "2.0",
      id: 1,
      method: "test",
    });
    proc.emit("close");

    await expect(promise).rejects.toThrow("MCP server process exited");
  });

  it("rejects pending requests on process error", async () => {
    const { proc } = createMockProcess();
    const transport = new StdioTransport("cmd", []);
    transport.start();

    const promise = transport.request({
      jsonrpc: "2.0",
      id: 1,
      method: "test",
    });
    proc.emit("error", new Error("spawn failed"));

    await expect(promise).rejects.toThrow("spawn failed");
  });

  it("rejects request if transport not started", async () => {
    const transport = new StdioTransport("cmd", []);
    await expect(
      transport.request({ jsonrpc: "2.0", id: 1, method: "test" }),
    ).rejects.toThrow("Transport is not running");
  });

  it("throws on notify if transport not started", () => {
    const transport = new StdioTransport("cmd", []);
    expect(() => transport.notify({ jsonrpc: "2.0", method: "test" })).toThrow(
      "Transport is not running",
    );
  });

  it("kills process on close", () => {
    const { proc } = createMockProcess();
    const transport = new StdioTransport("cmd", []);
    transport.start();

    transport.close();
    expect(proc.kill).toHaveBeenCalledWith("SIGTERM");
  });

  it("skips malformed JSON lines", async () => {
    const { proc, stdout } = createMockProcess();
    const transport = new StdioTransport("cmd", []);
    transport.start();

    const promise = transport.request({
      jsonrpc: "2.0",
      id: 1,
      method: "test",
    });

    stdout.emit("data", Buffer.from("not json\n"));
    sendResponse(stdout, { jsonrpc: "2.0", id: 1, result: "ok" });

    const response = await promise;
    expect(response.result).toBe("ok");

    transport.close();
    proc.removeAllListeners();
  });
});
