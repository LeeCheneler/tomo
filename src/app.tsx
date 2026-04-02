import { Box, Static } from "ink";
import { Chat } from "./chat/chat";
import { pingCommand } from "./commands/ping";
import { createCommandRegistry } from "./commands/registry";
import { useConfig } from "./config/hook";
import { AppHeader } from "./ui/app-header";
import { version } from "./utils/version";

/** Creates the application command registry with all built-in commands. */
function buildCommandRegistry() {
  const registry = createCommandRegistry();
  registry.register(pingCommand);
  registry.register({
    name: "pong",
    description: "Responds with ping",
    handler: () => "ping",
  });
  registry.register({
    name: "hello",
    description: "Greets you",
    handler: () => "Hello there!",
  });
  registry.register({
    name: "goodbye",
    description: "Says farewell",
    handler: () => "Goodbye!",
  });
  registry.register({
    name: "pong1",
    description: "Responds with ping",
    handler: () => "ping",
  });
  registry.register({
    name: "hello1",
    description: "Greets you",
    handler: () => "Hello there!",
  });
  registry.register({
    name: "goodbye1",
    description: "Says farewell",
    handler: () => "Goodbye!",
  });
  return registry;
}

/** Root application component. Renders the header and chat UI. */
export function App() {
  const config = useConfig();
  const commandRegistry = buildCommandRegistry();
  const staticItems = [{ id: "__header__" }];

  return (
    <>
      <Static items={staticItems}>
        {(item) => (
          <Box key={item.id} flexDirection="column" paddingBottom={1}>
            <AppHeader
              version={version}
              model={config.activeModel}
              provider={config.activeProvider}
            />
          </Box>
        )}
      </Static>
      <Chat commandRegistry={commandRegistry} />
    </>
  );
}
