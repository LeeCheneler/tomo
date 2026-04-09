import { z } from "zod";
import { runCompletionLoop } from "../agent/completion-loop";
import { loadConfig } from "../config/file";
import type { Agents } from "../config/schema";
import { createOpenAICompatibleClient } from "../provider/openai-compatible";
import { buildSubAgentSystemPrompt } from "../prompt/build-system-prompt";
import { getErrorMessage } from "../utils/error";
import type { ToolRegistry } from "./registry";
import { createToolRegistry } from "./registry";
import type { Tool, ToolContext, ToolResult } from "./types";
import { err, ok } from "./types";

/** Zod schema for the agent tool arguments. */
const argsSchema = z.object({
  name: z.string().min(1, "agent name is required"),
  prompt: z.string().min(1, "prompt is required"),
  timeout: z.number().int().positive().optional(),
});

// -- Concurrency semaphore --------------------------------------------------

let activeAgents = 0;
const waitQueue: Array<() => void> = [];

/** Acquires a concurrency slot, blocking if at capacity. */
async function acquireSlot(maxConcurrent: number): Promise<void> {
  if (activeAgents < maxConcurrent) {
    activeAgents++;
    return;
  }
  await new Promise<void>((resolve) => {
    waitQueue.push(resolve);
  });
  activeAgents++;
}

/** Releases a concurrency slot and wakes the next waiter. */
function releaseSlot(): void {
  activeAgents--;
  const next = waitQueue.shift();
  if (next) next();
}

// -- Sub-agent tool scoping -------------------------------------------------

/**
 * Builds a scoped tool registry for a sub-agent from the config allowlist.
 * Includes the agent tool itself when the sub-agent hasn't reached max depth.
 * MCP tools (names prefixed with `mcp__`) are auto-included so sub-agents
 * inherit any MCP servers the user has connected.
 */
function buildSubAgentToolRegistry(
  parentRegistry: ToolRegistry,
  agentsConfig: Agents,
  nextDepth: number,
): ToolRegistry {
  const registry = createToolRegistry();
  for (const name of agentsConfig.tools) {
    const tool = parentRegistry.get(name);
    if (tool) registry.register(tool);
  }
  // Auto-include all MCP tools — if the user enabled an MCP server, they want
  // it usable from sub-agents too, without having to remember to add each tool
  // name to the agents allowlist.
  for (const tool of parentRegistry.list()) {
    if (tool.name.startsWith("mcp__")) {
      registry.register(tool);
    }
  }
  // Allow nested agents if the next depth is still below max.
  // The agent tool may not be in the registry if it was disabled.
  const agentTool =
    nextDepth < agentsConfig.maxDepth ? parentRegistry.get("agent") : undefined;
  if (agentTool) registry.register(agentTool);
  return registry;
}

// -- Tool description -------------------------------------------------------

/** Builds the LLM-facing description for the agent tool. */
function buildDescription(agentsConfig: Agents): string {
  const mins = Math.round(agentsConfig.maxTimeoutSeconds / 60);
  const timeoutLabel =
    mins >= 1 ? `${mins}-minute` : `${agentsConfig.maxTimeoutSeconds}-second`;

  return `Spawn a sub-agent that autonomously researches, explores, or analyses. The sub-agent has access to tools for reading files, searching, running commands, and more. It returns a text summary when done.

You MUST use this tool when:
- The user asks to explore, investigate, describe, review, or understand a codebase or large area of code.
- The task requires reading more than 3 files.
- The task has multiple independent facets that can be researched in parallel.

Only use glob or grep directly for targeted searches involving 1-3 known files. For everything else, spawn sub-agents.

For multi-faceted tasks, call this tool multiple times in the same response — each agent runs in parallel. Break the task into focused research questions, one per agent.

Example: if asked "describe this codebase", spawn agents for: project structure, core features, testing approach, and build/config — four agents in one response.

Each agent has a default ${timeoutLabel} timeout which is sufficient for most tasks. Do NOT set a timeout unless you specifically need to cut an agent short. Omit timeout to use the default.`;
}

// -- Factory ----------------------------------------------------------------

/**
 * Creates the agent tool.
 *
 * Needs the parent tool registry to build scoped sub-agent registries at
 * execution time. The returned tool is registered in the same registry.
 */
export function createAgentTool(parentRegistry: ToolRegistry): Tool {
  const config = loadConfig();
  const description = buildDescription(config.agents);

  return {
    name: "agent",
    displayName: "Agent",
    description,
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description:
            "A short, descriptive name for the agent (e.g. 'auth-review', 'test-coverage').",
        },
        prompt: {
          type: "string",
          description: "The task for the sub-agent to perform.",
        },
        timeout: {
          type: "number",
          description:
            "Optional. Overrides the default timeout in seconds. Only set this to cut an agent short. Capped to the configured maximum.",
        },
      },
      required: ["name", "prompt"],
    },
    argsSchema,
    formatCall(args) {
      return String(args.name);
    },
    async execute(args: unknown, context: ToolContext): Promise<ToolResult> {
      const parsed = argsSchema.parse(args);

      // Read fresh config each invocation so runtime changes are picked up.
      const freshConfig = loadConfig();
      const agentsConfig = freshConfig.agents;
      const nextDepth = context.depth + 1;

      // Build scoped tools for the sub-agent.
      const subRegistry = buildSubAgentToolRegistry(
        parentRegistry,
        agentsConfig,
        nextDepth,
      );
      const toolDefs = subRegistry.getDefinitions();

      // Sub-agent confirm calls include the agent name as context.
      const subAgentContext: ToolContext = {
        ...context,
        depth: nextDepth,
        // Sub-agents don't stream progress to the parent UI — only the
        // completion loop's onContent does that via context.onProgress.
        onProgress: undefined,
        // Wrap confirm to inject agent name label.
        confirm: (message, options) =>
          context.confirm(message, {
            ...options,
            label: `Agent ${parsed.name}: ${options?.label ?? message}`,
          }),
      };

      // Per-call timeout capped to the global maximum.
      const effectiveTimeout = parsed.timeout
        ? Math.min(parsed.timeout, agentsConfig.maxTimeoutSeconds)
        : agentsConfig.maxTimeoutSeconds;

      const timeoutController = new AbortController();
      const timeoutId = setTimeout(
        () => timeoutController.abort(),
        effectiveTimeout * 1000,
      );

      const signal = AbortSignal.any([
        context.signal,
        timeoutController.signal,
      ]);

      const client = createOpenAICompatibleClient(context.provider);
      const toolNames = [...agentsConfig.tools];
      if (nextDepth < agentsConfig.maxDepth) toolNames.push("agent");
      const systemPrompt = buildSubAgentSystemPrompt(toolNames);

      await acquireSlot(agentsConfig.maxConcurrent);
      try {
        const result = await runCompletionLoop({
          client,
          model: context.model,
          contextWindow: context.contextWindow,
          systemPrompt,
          initialMessages: [{ role: "user", content: parsed.prompt }],
          tools: toolDefs.length > 0 ? toolDefs : undefined,
          toolRegistry: subRegistry,
          toolContext: { ...subAgentContext, signal },
          signal,
          // Stream sub-agent content to the parent's live output slot.
          onContent: context.onProgress,
        });

        return ok(result.content || "(sub-agent produced no output)");
      } catch (e) {
        // Distinguish timeout from parent abort.
        if (e instanceof DOMException && e.name === "AbortError") {
          if (timeoutController.signal.aborted && !context.signal.aborted) {
            return err(
              `Sub-agent "${parsed.name}" timed out after ${effectiveTimeout}s`,
            );
          }
          // Parent abort — propagate so the caller knows the conversation was cancelled.
          throw e;
        }
        return err(`Sub-agent "${parsed.name}" error: ${getErrorMessage(e)}`);
      } finally {
        clearTimeout(timeoutId);
        releaseSlot();
      }
    },
  };
}
