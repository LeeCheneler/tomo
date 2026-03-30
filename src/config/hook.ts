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
      permissions: { cwdReadFile: true },
      allowedCommands: [],
      tools: {
        agent: { enabled: true },
        ask: { enabled: true },
        editFile: { enabled: true },
        glob: { enabled: true },
        grep: { enabled: true },
        readFile: { enabled: true },
        runCommand: { enabled: true },
        skill: { enabled: true },
        webSearch: { enabled: false },
        writeFile: { enabled: true },
      },
    };
  }, []);
}
