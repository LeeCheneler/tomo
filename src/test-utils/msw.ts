import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";
import type { RequestHandler } from "msw";

/** Shared MSW server instance for all tests. */
const server = setupServer();

/**
 * Sets up MSW lifecycle hooks for the current test suite.
 * Call once at the top of a describe block that needs network mocking.
 * Use `server.use(...)` inside individual tests to add handlers.
 */
export function setupMsw(): typeof server {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());
  return server;
}

export { http, HttpResponse } from "msw";
export type { RequestHandler };
