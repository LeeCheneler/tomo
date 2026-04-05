import { type ReactNode, createContext, useContext, useState } from "react";
import { loadConfig } from "./file";
import type { Config } from "./schema";

/** Value exposed by the config context. */
interface ConfigContextValue {
  config: Config;
  reload: () => void;
}

/** React context for application config. */
const ConfigContext = createContext<ConfigContextValue | null>(null);

/** Props for ConfigProvider. */
interface ConfigProviderProps {
  children: ReactNode;
}

/** Provides application config to the component tree via React context. */
export function ConfigProvider(props: ConfigProviderProps) {
  const [config, setConfig] = useState(() => loadConfig());

  /** Re-reads config from disk and updates all consumers. */
  function reload() {
    setConfig(loadConfig());
  }

  return (
    <ConfigContext.Provider value={{ config, reload }}>
      {props.children}
    </ConfigContext.Provider>
  );
}

/** Returns the current config and a reload function from the nearest ConfigProvider. */
export function useConfig(): ConfigContextValue {
  const value = useContext(ConfigContext);
  if (!value) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return value;
}
