import { Box, Static } from "ink";
import { useState } from "react";
import { useConfig } from "./config/hook";
import { ChatInput } from "./ui/chat-input";
import { AppHeader } from "./ui/app-header";
import { version } from "./utils/version";

/** Root application component. Renders the header and chat UI. */
export function App() {
  const config = useConfig();
  const [value, setValue] = useState("");
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
      <ChatInput
        value={value}
        onChange={setValue}
        onSubmit={() => {}}
        statusText="1% context"
      />
    </>
  );
}
