import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";

/** State the retry wrapper needs from the owning MCP client closure. */
export interface AuthRetryContext {
  /**
   * Returns the currently pending authorization-code promise, or `null` if no
   * OAuth flow is in progress. The owning client sets this in the provider's
   * `onRedirect` callback before the SDK throws `UnauthorizedError`.
   */
  pendingCode: () => Promise<string> | null;
  /**
   * Clears the pending auth state after a successful code exchange so a
   * subsequent `UnauthorizedError` (e.g. mid-session) can trigger a fresh
   * flow rather than reusing a consumed code.
   */
  clearPending: () => void;
  /** Exchanges the authorization code for tokens via the underlying transport. */
  finishAuth: (code: string) => Promise<void>;
}

/**
 * Runs `op` and — if it throws `UnauthorizedError` — awaits the pending
 * authorization code, exchanges it for tokens via `finishAuth`, and retries
 * once.
 *
 * Errors other than `UnauthorizedError` are rethrown unchanged. If
 * `UnauthorizedError` is thrown but no auth flow is in progress (the SDK
 * raised it without calling our provider's `onRedirect`), the original
 * error is rethrown — there is no code to wait for.
 */
export async function withAuthRetry<T>(
  context: AuthRetryContext,
  op: () => Promise<T>,
): Promise<T> {
  try {
    return await op();
  } catch (error) {
    if (!(error instanceof UnauthorizedError)) throw error;
    const pending = context.pendingCode();
    if (!pending) throw error;
    const code = await pending;
    context.clearPending();
    await context.finishAuth(code);
    return await op();
  }
}
