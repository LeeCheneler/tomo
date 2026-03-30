import { Box, Static } from "ink";
import { useConfig } from "./config/hook.js";
import { AppHeader } from "./ui/app-header.js";

declare const TOMO_VERSION: string | undefined;
const version = typeof TOMO_VERSION !== "undefined" ? TOMO_VERSION : "dev";

/** Root application component. Renders the header and chat UI. */
export function App() {
  const config = useConfig();
  const staticItems = [{ id: "__header__" }];

  return (
    <Box flexDirection="column" paddingX={1}>
      <Static items={staticItems}>
        {(item) => (
          <Box key={item.id} flexDirection="column">
            <AppHeader
              version={version}
              model={config.activeModel}
              provider={config.activeProvider}
            />
          </Box>
        )}
      </Static>
    </Box>
  );
}
