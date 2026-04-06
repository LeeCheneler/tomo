import { vi } from "vitest";
import type { ToolContext } from "../tools/types";

/** Builds a ToolContext with sensible defaults for testing. */
export function mockToolContext(
  overrides: Partial<ToolContext> = {},
): ToolContext {
  return {
    permissions: {
      cwdReadFile: true,
      cwdWriteFile: true,
      globalReadFile: false,
      globalWriteFile: false,
    },
    confirm: vi.fn(async () => false),
    ask: vi.fn(async () => ""),
    signal: new AbortController().signal,
    ...overrides,
  };
}
