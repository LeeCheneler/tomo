import { Chat } from "./chat/chat";
import { contextCommand } from "./commands/context";
import { modelCommand } from "./commands/model";
import { newCommand } from "./commands/new";
import { createCommandRegistry } from "./commands/registry";
import { sessionCommand } from "./commands/session";
import { settingsCommand } from "./commands/settings";
import { readFileTool } from "./tools/read-file";
import { createToolRegistry } from "./tools/registry";
import { writeFileTool } from "./tools/write-file";

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

/** Creates the application tool registry with all built-in tools. */
function buildToolRegistry() {
  const registry = createToolRegistry();
  registry.register(readFileTool);
  registry.register(writeFileTool);
  return registry;
}

/** Root application component. Renders the chat UI. */
export function App() {
  const commandRegistry = buildCommandRegistry();
  const toolRegistry = buildToolRegistry();

  return <Chat commandRegistry={commandRegistry} toolRegistry={toolRegistry} />;
}
