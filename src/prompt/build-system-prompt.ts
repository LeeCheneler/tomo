import { getGitContext } from "./git-context";
import { loadInstructions } from "./instructions";
import { getSystemInfo } from "./system-info";

/** Returns guidance for tool usage behaviour. */
function getToolGuidance(): string {
  return `# Tool Usage

- Use the provided tools to accomplish tasks. Prefer tools over asking the user to perform actions manually.
- When a tool call is denied by the user, do NOT retry the same tool call. Respect the user's decision, explain what you were trying to do, and ask how they would like to proceed.
- Do not ask for permission before using a tool — the permission system handles that. Just call the tool directly.`;
}

/**
 * Builds the full system prompt for the main agent.
 * Composes system info, git context, and user instruction files into a
 * single string to be sent as the system message at index 0 of every
 * completion request.
 */
export function buildSystemPrompt(): string {
  const systemInfo = getSystemInfo();
  const gitContext = getGitContext(process.cwd());
  const instructions = loadInstructions();

  const parts = [systemInfo];
  if (gitContext) parts.push(gitContext);
  if (instructions) parts.push(instructions);

  parts.push(getToolGuidance());

  // TODO: append tool orchestration / sub-agent guidance after agents are implemented
  // TODO: append skills notice after skills are implemented

  return parts.join("\n\n");
}

// TODO: buildSubAgentSystemPrompt() — stripped-down variant with system info
// and git context only, plus read-only agent preamble. Needed when the agent
// tool is implemented.
