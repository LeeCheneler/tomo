import { z } from "zod";
import { runCompletionLoop } from "../completion-loop";
import { loadInstructions } from "../instructions";
import { getTool, registerTool } from "./registry";
import { type ToolContext, parseToolArgs, toToolDefinition } from "./types";

const argsSchema = z.object({
  prompt: z.string().min(1, "prompt is required"),
});

const MAX_AGENT_DEPTH = 1;

/** Tools available to sub-agents — read-only, non-interactive. */
const ALLOWED_TOOLS = ["read_file", "glob", "grep", "web_search", "skill"];

/** Builds the scoped system prompt for a sub-agent. */
function buildSubAgentSystemPrompt(): string {
  const base = loadInstructions() ?? "";
  return `${base}\n\nYou are a sub-agent spawned to handle a specific task. Work autonomously using the tools available to you. When your task is complete, produce a clear, concise summary of your findings or results.`;
}

/** Builds tool definitions for the sub-agent from the allowlist. */
function getSubAgentToolDefs(depth: number) {
  const names = [...ALLOWED_TOOLS];
  if (depth < MAX_AGENT_DEPTH) {
    names.push("agent");
  }
  return names
    .map((name) => getTool(name))
    .filter((t) => t != null)
    .map(toToolDefinition);
}

registerTool({
  name: "agent",
  description:
    "Spawn a sub-agent to autonomously research, explore, or analyse. The sub-agent has access to read-only tools (read_file, glob, grep, web_search, skill) and returns a summary when done. Use this for tasks that benefit from parallel exploration.",
  parameters: {
    type: "object",
    properties: {
      prompt: {
        type: "string",
        description: "The task for the sub-agent to perform",
      },
    },
    required: ["prompt"],
  },
  interactive: false,
  async execute(args: string, context: ToolContext): Promise<string> {
    const { prompt } = parseToolArgs(argsSchema, args);

    const { providerConfig } = context;
    const systemMessage = buildSubAgentSystemPrompt();
    const toolDefs = getSubAgentToolDefs(context.depth + 1);

    const subAgentContext: ToolContext = {
      renderInteractive: () => {
        throw new Error("Sub-agents cannot render interactive components");
      },
      reportProgress: () => {},
      permissions: context.permissions,
      signal: context.signal,
      depth: context.depth + 1,
      providerConfig,
    };

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
        signal: context.signal,
      });

      return result.content || "(sub-agent produced no output)";
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw err;
      }
      return `Sub-agent error: ${err instanceof Error ? err.message : String(err)}`;
    }
  },
});
