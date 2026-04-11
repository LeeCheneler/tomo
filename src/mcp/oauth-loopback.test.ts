import { afterEach, describe, expect, it } from "vitest";
import { createLoopbackCatcher } from "./oauth-loopback";

describe("createLoopbackCatcher", () => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    for (const cleanup of cleanups.splice(0)) {
      await cleanup();
    }
  });

  /** Starts a catcher and registers it for afterEach teardown. */
  async function start(options?: Parameters<typeof createLoopbackCatcher>[0]) {
    const catcher = await createLoopbackCatcher(options);
    cleanups.push(() => catcher.close());
    return catcher;
  }

  describe("binding", () => {
    it("binds an ephemeral port when none is provided", async () => {
      const catcher = await start();
      expect(catcher.port).toBeGreaterThan(0);
      expect(catcher.redirectUri).toBe(
        `http://127.0.0.1:${catcher.port}/callback`,
      );
    });

    it("binds a specific port when provided", async () => {
      // Ask the OS for a free port first so the test is deterministic.
      const probe = await start();
      const reservedPort = probe.port;
      await probe.close();
      cleanups.pop();

      const catcher = await start({ port: reservedPort });
      expect(catcher.port).toBe(reservedPort);
    });

    it("rejects when the requested port is already in use", async () => {
      const first = await start();
      await expect(
        createLoopbackCatcher({ port: first.port }),
      ).rejects.toThrow();
    });
  });

  describe("waitForCode happy path", () => {
    it("resolves with the code when state matches", async () => {
      const catcher = await start();
      const abort = new AbortController();
      const pending = catcher.waitForCode({
        expectedState: "abc123",
        signal: abort.signal,
      });

      const response = await fetch(
        `${catcher.redirectUri}?code=the-code&state=abc123`,
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toContain("Signed in");

      await expect(pending).resolves.toBe("the-code");
    });

    it("includes URL-encoded codes in the resolution", async () => {
      const catcher = await start();
      const abort = new AbortController();
      const pending = catcher.waitForCode({
        expectedState: "s",
        signal: abort.signal,
      });

      await fetch(
        `${catcher.redirectUri}?code=${encodeURIComponent("code with spaces/+")}&state=s`,
      );
      await expect(pending).resolves.toBe("code with spaces/+");
    });
  });

  describe("waitForCode rejections", () => {
    it("rejects on state mismatch and responds with 400", async () => {
      const catcher = await start();
      const abort = new AbortController();
      const pending = catcher.waitForCode({
        expectedState: "expected",
        signal: abort.signal,
      });
      // Attach the rejection assertion before the request that triggers it
      // so node does not see a transient unhandled rejection.
      const pendingAssertion =
        expect(pending).rejects.toThrow(/state mismatch/i);

      const response = await fetch(
        `${catcher.redirectUri}?code=the-code&state=wrong`,
      );
      expect(response.status).toBe(400);
      expect(await response.text()).toContain("State mismatch");

      await pendingAssertion;
    });

    it("rejects when the callback has an `error` parameter with description", async () => {
      const catcher = await start();
      const abort = new AbortController();
      const pending = catcher.waitForCode({
        expectedState: "s",
        signal: abort.signal,
      });
      const pendingAssertion = expect(pending).rejects.toThrow(
        /access_denied: User declined/,
      );

      const response = await fetch(
        `${catcher.redirectUri}?error=access_denied&error_description=User+declined&state=s`,
      );
      expect(response.status).toBe(400);
      const body = await response.text();
      expect(body).toContain("Authorization error");
      expect(body).toContain("access_denied");
      expect(body).toContain("User declined");

      await pendingAssertion;
    });

    it("rejects with just the error code when no description is present", async () => {
      const catcher = await start();
      const abort = new AbortController();
      const pending = catcher.waitForCode({
        expectedState: "s",
        signal: abort.signal,
      });
      const pendingAssertion = expect(pending).rejects.toThrow(
        /OAuth authorization error: invalid_scope$/,
      );

      const response = await fetch(
        `${catcher.redirectUri}?error=invalid_scope&state=s`,
      );
      expect(response.status).toBe(400);

      await pendingAssertion;
    });

    it("rejects when the callback is missing a code", async () => {
      const catcher = await start();
      const abort = new AbortController();
      const pending = catcher.waitForCode({
        expectedState: "s",
        signal: abort.signal,
      });
      const pendingAssertion =
        expect(pending).rejects.toThrow(/missing `code`/);

      const response = await fetch(`${catcher.redirectUri}?state=s`);
      expect(response.status).toBe(400);

      await pendingAssertion;
    });

    it("rejects when the wait times out", async () => {
      const catcher = await start();
      const abort = new AbortController();
      await expect(
        catcher.waitForCode({
          expectedState: "s",
          signal: abort.signal,
          timeoutMs: 20,
        }),
      ).rejects.toThrow(/timed out/);
    });

    it("rejects immediately when the signal is already aborted", async () => {
      const catcher = await start();
      const abort = new AbortController();
      abort.abort();
      await expect(
        catcher.waitForCode({
          expectedState: "s",
          signal: abort.signal,
        }),
      ).rejects.toThrow(/aborted/);
    });

    it("rejects when the signal is aborted mid-wait", async () => {
      const catcher = await start();
      const abort = new AbortController();
      const pending = catcher.waitForCode({
        expectedState: "s",
        signal: abort.signal,
      });
      abort.abort();
      await expect(pending).rejects.toThrow(/aborted/);
    });
  });

  describe("request routing", () => {
    it("404s non-callback paths", async () => {
      const catcher = await start();
      const response = await fetch(
        `http://127.0.0.1:${catcher.port}/anything-else`,
      );
      expect(response.status).toBe(404);
    });

    it("responds 409 when a callback arrives with no active wait", async () => {
      const catcher = await start();
      const response = await fetch(`${catcher.redirectUri}?code=stray&state=s`);
      expect(response.status).toBe(409);
    });
  });

  describe("close", () => {
    it("close is idempotent", async () => {
      const catcher = await start();
      await catcher.close();
      await expect(catcher.close()).resolves.toBeUndefined();
    });
  });
});
