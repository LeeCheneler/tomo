import type { Mock } from "vitest";
import { vi } from "vitest";
import type { ToolContext } from "./types";

/** ToolContext with mock functions exposed for test assertions. */
export type MockToolContext = Omit<
  ToolContext,
  "renderInteractive" | "reportProgress"
> & {
  renderInteractive: Mock;
  reportProgress: Mock;
};

/** Create a mock ToolContext with sensible defaults. Pass overrides for specific tests. */
export function makeMockContext(
  overrides?: Partial<
    Omit<ToolContext, "renderInteractive" | "reportProgress">
  >,
): MockToolContext {
  return {
    permissions: { read_file: true, write_file: false },
    signal: new AbortController().signal,
    depth: 0,
    providerConfig: {
      baseUrl: "http://localhost",
      model: "test-model",
      apiKey: undefined,
      maxTokens: 1024,
      contextWindow: 8192,
    },
    allowedCommands: [],
    ...overrides,
    renderInteractive: vi.fn().mockResolvedValue("approved"),
    reportProgress: vi.fn(),
  };
}
