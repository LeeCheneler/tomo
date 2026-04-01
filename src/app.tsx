import { Box, Static } from "ink";
import { Chat } from "./chat/chat";
import { useConfig } from "./config/hook";
import { AppHeader } from "./ui/app-header";
import { version } from "./utils/version";

/** Root application component. Renders the header and chat UI. */
export function App() {
  const config = useConfig();
  const staticItems = [{ id: "__header__" }];

  return (
    <>
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
      <Chat />
    </>
  );
}
