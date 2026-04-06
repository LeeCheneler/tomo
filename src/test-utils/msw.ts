import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll } from "vitest";
import type { RequestHandler } from "msw";

/** Shared MSW server instance for all tests. */
const server = setupServer();

/**
 * Sets up MSW lifecycle hooks for the current test suite.
 * Call once at the top of a describe block that needs network mocking.
 * Pass default handlers that persist across all tests in the suite —
 * they are re-applied after each reset so per-test handlers don't clear them.
 * Use `server.use(...)` inside individual tests to add per-test handlers.
 */
export function setupMsw(...defaultHandlers: RequestHandler[]): typeof server {
  beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
  afterEach(() => {
    server.resetHandlers();
    if (defaultHandlers.length > 0) {
      server.use(...defaultHandlers);
    }
  });
  afterAll(() => server.close());
  // Apply defaults immediately so they're active for the first test
  if (defaultHandlers.length > 0) {
    beforeAll(() => server.use(...defaultHandlers));
  }
  return server;
}

export { http, HttpResponse } from "msw";
export type { RequestHandler };
