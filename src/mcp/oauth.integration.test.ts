import { EventEmitter } from "node:events";
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
  vi,
} from "vitest";

const MOCK_OAUTH_SCRIPT = resolve(__dirname, "../../mock-mcps/http-oauth.mjs");
const PORT = 9879;
const URL_BASE = `http://localhost:${PORT}`;

/**
 * Mock `node:child_process.spawn` so `openUrl` does not actually spawn
 * macOS's `open`. Any other spawn call (including the one that launches the
 * mock OAuth server in `beforeAll`) falls through to the real implementation.
 *
 * When `open` is invoked, the mock schedules an async "fake browser" that
 * drives the authorization URL → follows the 302 → hits the loopback catcher,
 * which is what a real user's browser would do after signing in.
 */
vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return {
    ...actual,
    spawn: vi.fn((cmd: string, args?: readonly string[], opts?: unknown) => {
      if (cmd === "open" && args && args.length > 0) {
        const url = args[0];
        const proc = Object.assign(new EventEmitter(), {
          unref: vi.fn(),
        });
        setImmediate(() => {
          proc.emit("spawn");
          void driveAuthorize(url).catch((err) => {
            // Surface drive errors via stderr so test failures are obvious.
            console.error("fake-browser drive error:", err);
          });
        });
        return proc as unknown as import("node:child_process").ChildProcess;
      }
      return actual.spawn(
        cmd,
        args as readonly string[],
        opts as import("node:child_process").SpawnOptions,
      );
    }),
  };
});

const { spawn } = await import("node:child_process");

/**
 * Simulates a user clicking the authorization link in their browser: follows
 * the SDK-generated `/authorize` URL (with `redirect: "manual"`) to capture
 * the Location header, then fetches the loopback redirect URL so the
 * catcher's `waitForCode` resolves.
 */
async function driveAuthorize(url: string): Promise<void> {
  const authorizeResponse = await fetch(url, { redirect: "manual" });
  const location = authorizeResponse.headers.get("location");
  if (!location) {
    throw new Error(
      `/authorize did not redirect — status ${authorizeResponse.status}`,
    );
  }
  await fetch(location);
}

/** Imports used by the tests. Must come after the vi.mock block above. */
const { createHttpMcpClient } = await import("./client");

describe("MCP OAuth end-to-end", () => {
  let server: import("node:child_process").ChildProcess | null = null;
  let authDataDir: string;

  beforeAll(async () => {
    server = spawn("node", [MOCK_OAUTH_SCRIPT], {
      env: { ...process.env, PORT: String(PORT) },
      stdio: ["ignore", "pipe", "pipe"],
    });
    await new Promise<void>((resolveReady, rejectReady) => {
      const timeout = setTimeout(
        () => rejectReady(new Error("mock oauth server did not start")),
        5000,
      );
      server?.stdout?.on("data", (chunk: Buffer) => {
        if (chunk.toString().includes("listening")) {
          clearTimeout(timeout);
          resolveReady();
        }
      });
      server?.on("error", (err) => {
        clearTimeout(timeout);
        rejectReady(err);
      });
    });
  });

  afterAll(async () => {
    if (server && !server.killed) {
      server.kill("SIGTERM");
      await new Promise<void>((r) => server?.on("exit", () => r()));
    }
  });

  beforeEach(() => {
    authDataDir = mkdtempSync(resolve(tmpdir(), "tomo-oauth-integration-"));
  });

  afterEach(() => {
    rmSync(authDataDir, { recursive: true, force: true });
  });

  it("completes the full OAuth flow and lists tools", async () => {
    const client = await createHttpMcpClient({
      serverName: "oauth-mock",
      url: URL_BASE,
      authDataDir,
    });
    try {
      await client.connect();
      const tools = await client.listTools();
      expect(tools.map((t) => t.name)).toEqual(["get_weather"]);
    } finally {
      await client.disconnect();
    }
  });

  it("rethrows non-UnauthorizedError errors from the initial connect", async () => {
    // Point the client at a port nothing is listening on. The SDK's first
    // request fails with a network error — not an UnauthorizedError — so
    // the catch path should rethrow without entering the auth retry.
    const client = await createHttpMcpClient({
      serverName: "oauth-unreachable",
      url: "http://127.0.0.1:1", // reserved — nothing listens here
      authDataDir,
    });
    try {
      await expect(client.connect()).rejects.toThrow();
    } finally {
      await client.disconnect();
    }
  });

  it("transparently re-auths mid-session when a tool call 401s", async () => {
    const client = await createHttpMcpClient({
      serverName: "oauth-mock",
      url: URL_BASE,
      authDataDir,
    });
    try {
      await client.connect();

      // Prime the mock server so its next /mcp request returns 401.
      await fetch(`${URL_BASE}/__force_next_401`, { method: "POST" });

      // listTools' first send hits the 401 → SDK throws UnauthorizedError
      // → withAuthRetry awaits the pending code → drives a fresh auth
      // round via the fake browser → finishAuth → retries listTools.
      const tools = await client.listTools();
      expect(tools.map((t) => t.name)).toEqual(["get_weather"]);
    } finally {
      await client.disconnect();
    }
  });

  it("persists tokens so a second client can connect without re-authorising", async () => {
    // First connect runs the full flow and saves tokens to authDataDir.
    const first = await createHttpMcpClient({
      serverName: "oauth-mock",
      url: URL_BASE,
      authDataDir,
    });
    await first.connect();
    await first.disconnect();

    // Second connect reuses the persisted token — the fake browser should
    // not be invoked, and the spawn mock's `open` counter stays flat.
    vi.mocked(spawn).mockClear();
    const second = await createHttpMcpClient({
      serverName: "oauth-mock",
      url: URL_BASE,
      authDataDir,
    });
    try {
      await second.connect();
      const tools = await second.listTools();
      expect(tools.map((t) => t.name)).toEqual(["get_weather"]);
      const openCalls = vi
        .mocked(spawn)
        .mock.calls.filter((call) => call[0] === "open");
      expect(openCalls).toHaveLength(0);
    } finally {
      await second.disconnect();
    }
  });
});
