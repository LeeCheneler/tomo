import { useMemo } from "react";
import { loadConfig } from "./file";
import type { Config } from "./schema";

/** Loads application config from disk on first render. */
export function useConfig(): Config {
  return useMemo(() => loadConfig(), []);
}
