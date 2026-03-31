import { stringify } from "yaml";
import { GLOBAL_CONFIG_PATH, LOCAL_CONFIG_PATH } from "../config/file";
import type { Config } from "../config/schema";
import { type MockFsState, mockFs } from "./mock-fs";

/** Options for mockConfig. */
interface MockConfigOptions {
  global?: Partial<Config>;
  local?: Partial<Config>;
}

/**
 * Sets up a mock filesystem with global and/or local config files.
 * Accepts partial Config objects — serialises them to YAML at the correct paths.
 * Returns the mock fs state for assertions.
 */
export function mockConfig(options: MockConfigOptions = {}): MockFsState {
  const files: Record<string, string> = {};

  if (options.global) {
    files[GLOBAL_CONFIG_PATH] = stringify(options.global);
  }

  if (options.local) {
    files[LOCAL_CONFIG_PATH] = stringify(options.local);
  }

  return mockFs(files);
}
