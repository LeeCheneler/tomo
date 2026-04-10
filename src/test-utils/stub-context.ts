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
      cwdRemoveFile: true,
      cwdRemoveDir: true,
      globalReadFile: false,
      globalWriteFile: false,
      globalRemoveFile: false,
      globalRemoveDir: false,
    },
    allowedCommands: [],
    confirm: vi.fn(async () => false),
    ask: vi.fn(async () => ""),
    signal: new AbortController().signal,
    provider: {
      name: "test",
      type: "ollama",
      baseUrl: "http://localhost:11434",
    },
    model: "test-model",
    contextWindow: 8192,
    depth: 0,
    ...overrides,
  };
}
