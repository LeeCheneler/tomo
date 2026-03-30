import { useMemo } from "react";
import type { Config } from "./schema";

/** Loads and manages application config state. */
export function useConfig(): Config {
  return useMemo(() => {
    // TODO: load from config.yaml via file.ts
    return {
      activeModel: null,
      activeProvider: null,
      providers: [],
    };
  }, []);
}
