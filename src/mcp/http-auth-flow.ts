import type { AuthRetryContext } from "./auth-retry";

/** Minimum loopback-catcher surface needed by the flow. */
export interface HttpAuthFlowCatcher {
  waitForCode(options: {
    expectedState: string;
    signal: AbortSignal;
    timeoutMs?: number;
  }): Promise<string>;
}

/** Dependencies injected into the flow. */
export interface HttpAuthFlowInputs {
  /** Loopback server used to capture the authorization code. */
  catcher: HttpAuthFlowCatcher;
  /** Launches the system browser at the given authorization URL. */
  openUrl: (url: string) => Promise<void>;
  /** Exchanges the captured code for tokens via the transport. */
  finishAuth: (code: string) => Promise<void>;
}

/** Public surface of an HTTP MCP client's in-flight OAuth authorization. */
export interface HttpAuthFlow {
  /** Retry context to pass into `withAuthRetry` around transport operations. */
  retryContext: AuthRetryContext;
  /**
   * Provider hook invoked when the SDK wants to drive the user to an
   * authorization URL. Registers a pending code promise against the loopback
   * catcher and opens the browser, then resolves.
   */
  onRedirect: (authorizationUrl: URL) => Promise<void>;
  /**
   * Cancels any in-flight auth flow. Called from `disconnect` so a mid-flow
   * tear-down unblocks the loopback waiter.
   */
  abortIfActive: () => void;
}

/**
 * Creates a coordinated auth-flow state holder for an HTTP MCP client.
 *
 * Owns the `activeCode` / `activeAbort` refs that are set when the SDK drives
 * the user to the authorization URL and consumed by the retry wrapper when it
 * catches an `UnauthorizedError`. Extracted from `createHttpMcpClient` so the
 * closures are unit-testable without having to drive the full SDK transport.
 */
export function createHttpAuthFlow(inputs: HttpAuthFlowInputs): HttpAuthFlow {
  let code: Promise<string> | null = null;
  let abort: AbortController | null = null;

  return {
    retryContext: {
      pendingCode: () => code,
      clearPending: () => {
        code = null;
        abort = null;
      },
      finishAuth: (authorizationCode) => inputs.finishAuth(authorizationCode),
    },

    async onRedirect(authorizationUrl: URL) {
      const expectedState = authorizationUrl.searchParams.get("state") ?? "";
      const controller = new AbortController();
      abort = controller;
      code = inputs.catcher.waitForCode({
        expectedState,
        signal: controller.signal,
      });
      await inputs.openUrl(authorizationUrl.toString());
    },

    abortIfActive() {
      if (abort) {
        abort.abort();
        abort = null;
        code = null;
      }
    },
  };
}
