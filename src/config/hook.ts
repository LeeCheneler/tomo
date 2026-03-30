import { useMemo } from "react";
import type { Config } from "./schema";

/** Loads and manages application config state. */
export function useConfig(): Config {
  return useMemo(() => {
    return {
      activeModel: null,
      activeProvider: null,
    };
  }, []);
}
