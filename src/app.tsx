import { Chat } from "./chat/chat";
import { contextCommand } from "./commands/context";
import { modelCommand } from "./commands/model";
import { newCommand } from "./commands/new";
import { createCommandRegistry } from "./commands/registry";
import { sessionCommand } from "./commands/session";
import { settingsCommand } from "./commands/settings";

/** Creates the application command registry with all built-in commands. */
function buildCommandRegistry() {
  const registry = createCommandRegistry();
  registry.register(contextCommand);
  registry.register(modelCommand);
  registry.register(newCommand);
  registry.register(sessionCommand);
  registry.register(settingsCommand);
  return registry;
}

/** Root application component. Renders the chat UI. */
export function App() {
  const commandRegistry = buildCommandRegistry();

  return <Chat commandRegistry={commandRegistry} />;
}
