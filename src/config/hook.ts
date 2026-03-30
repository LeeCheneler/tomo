import { useMemo } from "react";

/** Loads and manages application config state. */
export function useConfig() {
  return useMemo(() => {
    // TODO: load from config.yaml
    return {
      activeModel: "none",
      activeProvider: "none",
    };
  }, []);
}
