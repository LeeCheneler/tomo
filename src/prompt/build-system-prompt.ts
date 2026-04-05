import { getGitContext } from "./git-context";
import { loadInstructions } from "./instructions";
import { getSystemInfo } from "./system-info";

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

  // TODO: append tool usage guidance after tools are implemented
  // TODO: append tool orchestration / sub-agent guidance after agents are implemented
  // TODO: append skills notice after skills are implemented

  return parts.join("\n\n");
}

// TODO: buildSubAgentSystemPrompt() — stripped-down variant with system info
// and git context only, plus read-only agent preamble. Needed when the agent
// tool is implemented.
