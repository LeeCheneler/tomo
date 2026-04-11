import { createServer } from "node:http";

/** Default timeout for the authorization callback — 5 minutes. */
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

/** Options for creating a loopback catcher. */
export interface CreateLoopbackCatcherOptions {
  /** Fixed port to bind. Omit to let the OS assign an ephemeral port. */
  port?: number;
}

/** Options for `waitForCode`. */
export interface WaitForCodeOptions {
  /** OAuth `state` value the callback must echo back for the code to be accepted. */
  expectedState: string;
  /** Aborts the wait — the promise rejects and the waiter is cleared. */
  signal: AbortSignal;
  /** Overrides the default 5-minute wait. */
  timeoutMs?: number;
}

/** A loopback HTTP server that catches a single OAuth authorization-code redirect. */
export interface LoopbackCatcher {
  /** Redirect URI advertised to the authorization server (e.g. `http://127.0.0.1:54321/callback`). */
  redirectUri: string;
  /** Bound port — persist this so the same URI can be reused across restarts. */
  port: number;
  /** Resolves with the authorization code, rejects on state mismatch, OAuth error, abort, or timeout. */
  waitForCode(options: WaitForCodeOptions): Promise<string>;
  /** Shuts down the underlying HTTP server. Idempotent. */
  close(): Promise<void>;
}

/**
 * Binds an HTTP server to `127.0.0.1` that listens for a single OAuth
 * authorization-code redirect on `/callback`. A fixed port can be supplied so
 * the same redirect URI (registered at DCR time) can be reused across
 * restarts; when omitted the OS assigns an ephemeral port.
 */
export function createLoopbackCatcher(
  options: CreateLoopbackCatcherOptions = {},
): Promise<LoopbackCatcher> {
  return new Promise((resolveCreate, rejectCreate) => {
    // Set by waitForCode while a flow is in progress. Given the callback URL,
    // returns the HTTP response body to send to the browser and settles the
    // wait promise as a side effect. Null means no flow is currently active.
    let dispatch: ((url: URL) => { status: number; body: string }) | null =
      null;

    const server = createServer((req, res) => {
      /* v8 ignore next -- req.url is always set by the node http parser */
      const url = new URL(req.url ?? "/", "http://127.0.0.1");
      const result =
        url.pathname !== "/callback"
          ? { status: 404, body: "Not Found" }
          : !dispatch
            ? { status: 409, body: "No active OAuth flow" }
            : dispatch(url);
      res.writeHead(result.status, { "content-type": "text/plain" });
      res.end(result.body);
    });

    server.once("error", rejectCreate);
    server.listen(options.port ?? 0, "127.0.0.1", () => {
      const address = server.address();
      /* v8 ignore next 5 -- TCP listens always return an AddressInfo object */
      if (typeof address !== "object" || address === null) {
        server.close();
        rejectCreate(new Error("loopback server did not bind to a TCP port"));
        return;
      }
      const port = address.port;

      resolveCreate({
        redirectUri: `http://127.0.0.1:${port}/callback`,
        port,
        waitForCode(waitOpts) {
          return new Promise<string>((resolve, reject) => {
            const timeoutMs = waitOpts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

            const cleanup = () => {
              clearTimeout(timer);
              waitOpts.signal.removeEventListener("abort", onAbort);
              dispatch = null;
            };

            const onAbort = () => {
              cleanup();
              reject(new Error("loopback wait aborted"));
            };

            const timer = setTimeout(() => {
              cleanup();
              reject(new Error(`loopback wait timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            if (waitOpts.signal.aborted) {
              cleanup();
              reject(new Error("loopback wait aborted"));
              return;
            }
            waitOpts.signal.addEventListener("abort", onAbort, { once: true });

            dispatch = (url) => {
              cleanup();
              const error = url.searchParams.get("error");
              if (error) {
                const description = url.searchParams.get("error_description");
                const message = description
                  ? `${error}: ${description}`
                  : error;
                reject(new Error(`OAuth authorization error: ${message}`));
                return { status: 400, body: `Authorization error: ${message}` };
              }
              if (url.searchParams.get("state") !== waitOpts.expectedState) {
                reject(new Error("OAuth callback state mismatch"));
                return { status: 400, body: "State mismatch" };
              }
              const code = url.searchParams.get("code");
              if (!code) {
                reject(new Error("OAuth callback missing `code` parameter"));
                return { status: 400, body: "Missing code" };
              }
              resolve(code);
              return {
                status: 200,
                body: "Signed in. You can close this tab and return to tomo.",
              };
            };
          });
        },
        close() {
          return new Promise<void>((r) => server.close(() => r()));
        },
      });
    });
  });
}
