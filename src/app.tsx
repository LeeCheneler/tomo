import { Chat } from "./chat/chat";
import { contextCommand } from "./commands/context";
import { modelCommand } from "./commands/model";
import { newCommand } from "./commands/new";
import { createCommandRegistry } from "./commands/registry";
import { sessionCommand } from "./commands/session";
import { settingsCommand } from "./commands/settings";
import { loadConfig } from "./config/file";
import { discoverSkillSets, loadSkillSetSkills } from "./skill-sets/loader";
import { loadAllSkills } from "./skills/loader";
import type { SkillRegistry } from "./skills/registry";
import { createSkillRegistry } from "./skills/registry";
import { askTool } from "./tools/ask";
import { editFileTool } from "./tools/edit-file";
import { globTool } from "./tools/glob";
import { grepTool } from "./tools/grep";
import { readFileTool } from "./tools/read-file";
import { createToolRegistry } from "./tools/registry";
import { runCommandTool } from "./tools/run-command";
import { createSkillTool } from "./tools/skill";
import { webSearchTool } from "./tools/web-search";
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

/** Creates the application skill registry from global, local, and skill set skills. */
function buildSkillRegistry() {
  const registry = createSkillRegistry();

  // Load skills from enabled skill sets (lowest priority — global/local override these).
  const config = loadConfig();
  for (const source of config.skillSets.sources) {
    try {
      const discovered = discoverSkillSets(source.url);
      for (const set of discovered) {
        if (!source.enabledSets.includes(set.name)) continue;
        for (const skill of loadSkillSetSkills(set)) {
          registry.register(skill);
        }
      }
    } catch {
      // Skip sources that fail to discover (e.g. missing clone, permission error).
    }
  }

  // Global and local skills override skill set skills.
  for (const skill of loadAllSkills()) {
    registry.register(skill);
  }

  return registry;
}

/** Creates the application tool registry with all built-in tools. */
function buildToolRegistry(skillRegistry: SkillRegistry) {
  const registry = createToolRegistry();
  registry.register(askTool);
  registry.register(readFileTool);
  registry.register(writeFileTool);
  registry.register(editFileTool);
  registry.register(globTool);
  registry.register(grepTool);
  registry.register(runCommandTool);
  registry.register(createSkillTool(skillRegistry));
  registry.register(webSearchTool);
  return registry;
}

/** Root application component. Renders the chat UI. */
export function App() {
  const commandRegistry = buildCommandRegistry();
  const skillRegistry = buildSkillRegistry();
  const toolRegistry = buildToolRegistry(skillRegistry);

  return (
    <Chat
      commandRegistry={commandRegistry}
      skillRegistry={skillRegistry}
      toolRegistry={toolRegistry}
    />
  );
}
