import { UnauthorizedError } from "@modelcontextprotocol/sdk/client/auth.js";
import { describe, expect, it, vi } from "vitest";
import { type AuthRetryContext, withAuthRetry } from "./auth-retry";

/** Builds an `AuthRetryContext` whose methods are all vitest spies. */
function makeContext(
  overrides: Partial<AuthRetryContext> = {},
): AuthRetryContext {
  return {
    pendingCode: vi.fn(() => null),
    clearPending: vi.fn(),
    finishAuth: vi.fn(async () => {}),
    ...overrides,
  };
}

describe("withAuthRetry", () => {
  it("returns the operation result when it succeeds on the first try", async () => {
    const context = makeContext();
    const op = vi.fn(async () => "ok");

    const result = await withAuthRetry(context, op);

    expect(result).toBe("ok");
    expect(op).toHaveBeenCalledTimes(1);
    expect(context.finishAuth).not.toHaveBeenCalled();
  });

  it("rethrows non-UnauthorizedError errors without retrying", async () => {
    const context = makeContext();
    const boom = new Error("boom");
    const op = vi.fn(async () => {
      throw boom;
    });

    await expect(withAuthRetry(context, op)).rejects.toBe(boom);
    expect(op).toHaveBeenCalledTimes(1);
    expect(context.finishAuth).not.toHaveBeenCalled();
  });

  it("rethrows the UnauthorizedError when no auth flow is pending", async () => {
    const unauthorized = new UnauthorizedError("no tokens");
    const context = makeContext({ pendingCode: vi.fn(() => null) });
    const op = vi.fn(async () => {
      throw unauthorized;
    });

    await expect(withAuthRetry(context, op)).rejects.toBe(unauthorized);
    expect(op).toHaveBeenCalledTimes(1);
    expect(context.finishAuth).not.toHaveBeenCalled();
  });

  it("awaits the pending code, exchanges it, and retries the operation on UnauthorizedError", async () => {
    const pending = Promise.resolve("the-code");
    const context = makeContext({
      pendingCode: vi.fn(() => pending),
    });
    const op = vi.fn(async () => {
      if (op.mock.calls.length === 1) throw new UnauthorizedError("401");
      return "retried-ok";
    });

    const result = await withAuthRetry(context, op);

    expect(result).toBe("retried-ok");
    expect(op).toHaveBeenCalledTimes(2);
    expect(context.finishAuth).toHaveBeenCalledWith("the-code");
    expect(context.clearPending).toHaveBeenCalledTimes(1);
  });

  it("propagates a rejection from the pending-code promise", async () => {
    const pending = Promise.reject(new Error("loopback wait aborted"));
    const context = makeContext({ pendingCode: vi.fn(() => pending) });
    const op = vi.fn(async () => {
      throw new UnauthorizedError("401");
    });

    await expect(withAuthRetry(context, op)).rejects.toThrow(
      /loopback wait aborted/,
    );
    expect(op).toHaveBeenCalledTimes(1);
    expect(context.finishAuth).not.toHaveBeenCalled();
  });

  it("propagates a rejection from finishAuth without retrying", async () => {
    const context = makeContext({
      pendingCode: vi.fn(() => Promise.resolve("code")),
      finishAuth: vi.fn(async () => {
        throw new Error("token exchange failed");
      }),
    });
    const op = vi.fn(async () => {
      throw new UnauthorizedError("401");
    });

    await expect(withAuthRetry(context, op)).rejects.toThrow(
      /token exchange failed/,
    );
    expect(op).toHaveBeenCalledTimes(1);
    expect(context.clearPending).toHaveBeenCalledTimes(1);
  });
});
