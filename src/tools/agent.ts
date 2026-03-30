import { z } from "zod";
import { runCompletionLoop } from "../completion-loop";
import { type AgentsConfig, getAgentsConfig, loadConfig } from "../config";
import { getErrorMessage } from "../errors";
import { loadSubAgentInstructions } from "../instructions";
import type { ChatMessage } from "../provider/client";
import { addAgent, incrementToolCalls, removeAgent } from "./agent-tracker";
import { getTool, registerTool } from "./registry";
import {
  err,
  ok,
  parseToolArgs,
  type ToolContext,
  type ToolResult,
  toToolDefinition,
} from "./types";

const argsSchema = z.object({
  prompt: z.string().min(1, "prompt is required"),
  timeout: z.number().int().positive().optional(),
});

/** Builds the scoped system prompt for a sub-agent. */
function buildSubAgentSystemPrompt(): string {
  return loadSubAgentInstructions();
}

/** Builds tool definitions for the sub-agent from the configured allowlist. */
function getSubAgentToolDefs(agentsConfig: AgentsConfig, depth: number) {
  const names = [...agentsConfig.tools];
  if (depth < agentsConfig.maxDepth) {
    names.push("agent");
  }
  return names
    .map((name) => getTool(name))
    .filter((t) => t != null)
    .map(toToolDefinition);
}

// Concurrency semaphore — limits how many agents run simultaneously.
let activeAgents = 0;
const waitQueue: Array<() => void> = [];

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

function releaseSlot(): void {
  activeAgents--;
  const next = waitQueue.shift();
  if (next) next();
}

function buildDescription(): string {
  const agentsConfig = getAgentsConfig(loadConfig());
  const mins = Math.round(agentsConfig.timeoutSeconds / 60);
  const timeoutLabel =
    mins >= 1 ? `${mins}-minute` : `${agentsConfig.timeoutSeconds}-second`;
  return `Spawn a sub-agent that autonomously researches, explores, or analyses. The sub-agent has access to read-only tools (read_file, glob, grep, web_search, skill) and returns a text summary when done. It cannot edit files, write files, or run commands.

You MUST use this tool when:
- The user asks to explore, investigate, describe, review, or understand a codebase or large area of code.
- The task requires reading more than 3 files.
- The task has multiple independent facets that can be researched in parallel.

Only use glob or grep directly for targeted searches involving 1-3 known files. For everything else, spawn sub-agents.

For multi-faceted tasks, call this tool multiple times in the same response — each agent runs in parallel. Break the task into focused research questions, one per agent.

Example: if asked "describe this codebase", spawn agents for: project structure, core features, testing approach, and build/config — four agents in one response.

Each agent has a default ${timeoutLabel} timeout which is sufficient for most tasks. Do NOT set a timeout unless you specifically need to cut an agent short. Omit timeout to use the default.`;
}

registerTool({
  name: "agent",
  displayName: "Agent",
  description: buildDescription(),
  parameters: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "The task for the sub-agent to perform",
      },
      timeout: {
        type: "number",
        description:
          "Optional. Overrides the default timeout. Only set this to cut an agent short — e.g. a quick check that should fail fast within seconds. Capped to the configured maximum.",
      },
    },
    required: ["prompt"],
  },
  interactive: false,
  async execute(args: string, context: ToolContext): Promise<ToolResult> {
    const { prompt, timeout: requestedTimeout } = parseToolArgs(
      argsSchema,
      args,
    );

    const freshConfig = loadConfig();
    const agentsConfig = getAgentsConfig(freshConfig);
    const { providerConfig } = context;
    const systemMessage = buildSubAgentSystemPrompt();
    const toolDefs = getSubAgentToolDefs(agentsConfig, context.depth + 1);

    const subAgentContext: ToolContext = {
      renderInteractive: () => {
        throw new Error("Sub-agents cannot render interactive components");
      },
      reportProgress: () => {},
      permissions: context.permissions,
      signal: context.signal,
      depth: context.depth + 1,
      providerConfig,
      allowedCommands: context.allowedCommands,
    };

    // Per-call timeout capped to the global maximum.
    const effectiveTimeout = requestedTimeout
      ? Math.min(requestedTimeout, agentsConfig.timeoutSeconds)
      : agentsConfig.timeoutSeconds;

    const timeoutController = new AbortController();
    const timeoutId = setTimeout(
      () => timeoutController.abort(),
      effectiveTimeout * 1000,
    );

    const signal = AbortSignal.any([context.signal, timeoutController.signal]);

    const agentId = crypto.randomUUID();
    addAgent(agentId, prompt);

    await acquireSlot(agentsConfig.maxConcurrent);
    try {
      const result = await runCompletionLoop({
        baseUrl: providerConfig.baseUrl,
        model: providerConfig.model,
        apiKey: providerConfig.apiKey,
        systemMessage,
        initialMessages: [{ role: "user", content: prompt }],
        tools: toolDefs.length > 0 ? toolDefs : undefined,
        toolContext: subAgentContext,
        maxTokens: providerConfig.maxTokens,
        contextWindow: providerConfig.contextWindow,
        signal,
        onMessage: (msg: ChatMessage) => {
          if (msg.role === "tool") {
            incrementToolCalls(agentId);
          }
        },
      });

      return ok(result.content || "(sub-agent produced no output)");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        if (timeoutController.signal.aborted && !context.signal.aborted) {
          return err(`Sub-agent timed out after ${effectiveTimeout}s`);
        }
        throw e;
      }
      return err(`Sub-agent error: ${getErrorMessage(e)}`);
    } finally {
      clearTimeout(timeoutId);
      removeAgent(agentId);
      releaseSlot();
    }
  },
});
