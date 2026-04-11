import { describe, expect, it, vi } from "vitest";
import { createHttpAuthFlow } from "./http-auth-flow";

/** Builds an HttpAuthFlowInputs with spy-backed defaults, overridable per test. */
function makeInputs(
  overrides: {
    waitForCode?: (opts: {
      expectedState: string;
      signal: AbortSignal;
      timeoutMs?: number;
    }) => Promise<string>;
    openUrl?: (url: string) => Promise<void>;
    finishAuth?: (code: string) => Promise<void>;
  } = {},
) {
  return {
    catcher: {
      waitForCode: overrides.waitForCode ?? vi.fn(async () => "default-code"),
    },
    openUrl: overrides.openUrl ?? vi.fn(async () => {}),
    finishAuth: overrides.finishAuth ?? vi.fn(async () => {}),
  };
}

describe("createHttpAuthFlow", () => {
  describe("retryContext.pendingCode", () => {
    it("is null before any flow starts", () => {
      const flow = createHttpAuthFlow(makeInputs());
      expect(flow.retryContext.pendingCode()).toBeNull();
    });

    it("returns the registered promise after onRedirect runs", async () => {
      const waitForCode = vi.fn(async () => "the-code");
      const flow = createHttpAuthFlow(makeInputs({ waitForCode }));
      await flow.onRedirect(
        new URL("https://auth.example.com/authorize?state=abc"),
      );
      const pending = flow.retryContext.pendingCode();
      expect(pending).not.toBeNull();
      await expect(pending).resolves.toBe("the-code");
    });
  });

  describe("retryContext.clearPending", () => {
    it("resets both the code and the abort references", async () => {
      const flow = createHttpAuthFlow(makeInputs());
      await flow.onRedirect(
        new URL("https://auth.example.com/authorize?state=abc"),
      );
      flow.retryContext.clearPending();
      expect(flow.retryContext.pendingCode()).toBeNull();
      // After clearPending, abortIfActive must not re-fire the controller
      // (nothing to observe directly, but this also covers the no-op branch).
      expect(() => flow.abortIfActive()).not.toThrow();
    });
  });

  describe("retryContext.finishAuth", () => {
    it("delegates to the configured finishAuth", async () => {
      const finishAuth = vi.fn(async () => {});
      const flow = createHttpAuthFlow(makeInputs({ finishAuth }));
      await flow.retryContext.finishAuth("the-code");
      expect(finishAuth).toHaveBeenCalledWith("the-code");
    });
  });

  describe("onRedirect", () => {
    it("passes the state parameter and signal to the catcher", async () => {
      const waitForCode = vi
        .fn<
          (opts: {
            expectedState: string;
            signal: AbortSignal;
            timeoutMs?: number;
          }) => Promise<string>
        >()
        .mockResolvedValue("code");
      const flow = createHttpAuthFlow(makeInputs({ waitForCode }));
      await flow.onRedirect(
        new URL("https://auth.example.com/authorize?state=xyz"),
      );
      expect(waitForCode).toHaveBeenCalledTimes(1);
      const args = waitForCode.mock.calls[0]?.[0];
      expect(args?.expectedState).toBe("xyz");
      expect(args?.signal).toBeInstanceOf(AbortSignal);
    });

    it("defaults expectedState to empty string when the URL has no state", async () => {
      const waitForCode = vi
        .fn<
          (opts: {
            expectedState: string;
            signal: AbortSignal;
            timeoutMs?: number;
          }) => Promise<string>
        >()
        .mockResolvedValue("code");
      const flow = createHttpAuthFlow(makeInputs({ waitForCode }));
      await flow.onRedirect(new URL("https://auth.example.com/authorize"));
      expect(waitForCode.mock.calls[0]?.[0]?.expectedState).toBe("");
    });

    it("opens the authorization URL in the browser", async () => {
      const openUrl = vi.fn(async () => {});
      const flow = createHttpAuthFlow(makeInputs({ openUrl }));
      await flow.onRedirect(
        new URL("https://auth.example.com/authorize?state=s"),
      );
      expect(openUrl).toHaveBeenCalledWith(
        "https://auth.example.com/authorize?state=s",
      );
    });

    it("aborts the previously-registered flow when a second onRedirect arrives", async () => {
      // Capture each onRedirect's AbortSignal so we can assert the first
      // was aborted by the second call — otherwise a stale loopback
      // waiter would race the new dispatch.
      const capturedSignals: AbortSignal[] = [];
      const flow = createHttpAuthFlow(
        makeInputs({
          waitForCode: async (opts) => {
            capturedSignals.push(opts.signal);
            return "code";
          },
        }),
      );
      await flow.onRedirect(
        new URL("https://auth.example.com/authorize?state=first"),
      );
      await flow.onRedirect(
        new URL("https://auth.example.com/authorize?state=second"),
      );
      expect(capturedSignals).toHaveLength(2);
      expect(capturedSignals[0]?.aborted).toBe(true);
      expect(capturedSignals[1]?.aborted).toBe(false);

      flow.abortIfActive();
      expect(capturedSignals[1]?.aborted).toBe(true);
      expect(flow.retryContext.pendingCode()).toBeNull();
    });
  });

  describe("beginFlow", () => {
    it("registers the supplied code promise as pending", async () => {
      const flow = createHttpAuthFlow(makeInputs());
      const abort = new AbortController();
      flow.beginFlow(abort, Promise.resolve("direct-code"));
      await expect(flow.retryContext.pendingCode()).resolves.toBe(
        "direct-code",
      );
    });

    it("abortIfActive cancels the controller registered via beginFlow", () => {
      const flow = createHttpAuthFlow(makeInputs());
      const abort = new AbortController();
      flow.beginFlow(abort, Promise.resolve("code"));
      flow.abortIfActive();
      expect(abort.signal.aborted).toBe(true);
      expect(flow.retryContext.pendingCode()).toBeNull();
    });

    it("aborts a previous onRedirect flow when beginFlow supersedes it", async () => {
      const capturedSignals: AbortSignal[] = [];
      const flow = createHttpAuthFlow(
        makeInputs({
          waitForCode: async (opts) => {
            capturedSignals.push(opts.signal);
            return "code";
          },
        }),
      );
      await flow.onRedirect(
        new URL("https://auth.example.com/authorize?state=s"),
      );
      const abort = new AbortController();
      flow.beginFlow(abort, Promise.resolve("direct-code"));
      expect(capturedSignals[0]?.aborted).toBe(true);
      expect(abort.signal.aborted).toBe(false);
    });
  });

  describe("abortIfActive", () => {
    it("is a no-op when no flow is active", () => {
      const flow = createHttpAuthFlow(makeInputs());
      expect(() => flow.abortIfActive()).not.toThrow();
    });

    it("aborts the controller registered by the latest onRedirect", async () => {
      // Capture the signal passed to waitForCode so we can assert the abort
      // is propagated correctly.
      let capturedSignal: AbortSignal | undefined;
      const flow = createHttpAuthFlow(
        makeInputs({
          waitForCode: async (opts) => {
            capturedSignal = opts.signal;
            return "code";
          },
        }),
      );
      await flow.onRedirect(
        new URL("https://auth.example.com/authorize?state=s"),
      );
      flow.abortIfActive();
      expect(capturedSignal?.aborted).toBe(true);
      expect(flow.retryContext.pendingCode()).toBeNull();
    });
  });
});
