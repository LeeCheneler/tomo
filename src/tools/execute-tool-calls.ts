import type { ChatMessage, ToolCallInfo } from "../chat/message";
import type { ToolCall } from "../provider/client";
import { getErrorMessage } from "../utils/error";
import type { ToolRegistry } from "./registry";
import type { ToolContext } from "./types";
import { parseToolArgs } from "./types";

/** Factory that creates a scoped onProgress callback for a specific tool call. */
export type CreateOnProgress = (toolCallId: string) => (output: string) => void;

/** Called when an individual tool completes with its [call, result] pair. */
export type OnToolComplete = (
  toolCallId: string,
  callMsg: ChatMessage,
  resultMsg: ChatMessage,
) => void;

/** Builds display info for a batch of tool calls from the LLM. */
export function buildToolCallInfos(
  toolCalls: ToolCall[],
  registry: ToolRegistry,
): ToolCallInfo[] {
  return toolCalls.map((tc) => {
    const tool = registry.get(tc.function.name);
    let summary = "";
    if (tool) {
      try {
        summary = tool.formatCall(JSON.parse(tc.function.arguments));
      } catch {
        // Invalid JSON — leave summary empty
      }
    }
    return {
      id: tc.id,
      name: tc.function.name,
      displayName: tool?.displayName ?? tc.function.name,
      arguments: tc.function.arguments,
      summary,
    };
  });
}

/**
 * Executes a batch of tool calls from the LLM in parallel.
 *
 * Returns interleaved pairs: [toolCall1, result1, toolCall2, result2, ...].
 * Each ToolCallMessage contains a single tool call so it renders paired
 * with its result in the chat list.
 *
 * When `onToolComplete` is provided, each [call, result] pair is reported
 * as soon as that tool finishes — allowing the UI to hoist completed tools
 * to the static area individually rather than waiting for the entire batch.
 *
 * Each tool gets a scoped `onProgress` callback via `createOnProgress` so
 * multiple tools can stream live output to separate UI slots simultaneously.
 */
export async function executeToolCalls(
  toolCalls: ToolCall[],
  assistantContent: string,
  registry: ToolRegistry,
  context: ToolContext,
  createOnProgress?: CreateOnProgress,
  onToolComplete?: OnToolComplete,
): Promise<ChatMessage[]> {
  const toolCallInfos = buildToolCallInfos(toolCalls, registry);

  /** Executes a single tool call and returns its [call, result] pair. */
  async function executeOne(
    tc: ToolCall,
    index: number,
  ): Promise<[ChatMessage, ChatMessage]> {
    const callMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "tool-call",
      // Only the first call carries the assistant's text content.
      content: index === 0 ? assistantContent : "",
      toolCalls: [toolCallInfos[index]],
    };

    const tool = registry.get(tc.function.name);
    if (!tool) {
      const resultMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "tool-result",
        toolCallId: tc.id,
        toolName: tc.function.name,
        output: `Unknown tool: ${tc.function.name}`,
        status: "error",
        format: "plain",
      };
      onToolComplete?.(tc.id, callMsg, resultMsg);
      return [callMsg, resultMsg];
    }

    const scopedContext: ToolContext = {
      ...context,
      onProgress: createOnProgress?.(tc.id),
    };

    let output: string;
    let status: "ok" | "error" | "denied" = "ok";
    let format: "plain" | "diff" = "plain";
    try {
      const parsed = parseToolArgs(tool.argsSchema, tc.function.arguments);
      const result = await tool.execute(parsed, scopedContext);
      output = result.output;
      status = result.status;
      format = result.format;
    } catch (e) {
      output = `Tool error: ${getErrorMessage(e)}`;
      status = "error";
    }

    const resultMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "tool-result",
      toolCallId: tc.id,
      toolName: tc.function.name,
      output,
      status,
      format,
    };
    onToolComplete?.(tc.id, callMsg, resultMsg);
    return [callMsg, resultMsg];
  }

  // Execute all tools in parallel, collecting [call, result] pairs.
  const pairs = await Promise.all(toolCalls.map((tc, i) => executeOne(tc, i)));

  // Flatten pairs into interleaved sequence: [call1, result1, call2, result2, ...]
  return pairs.flat();
}
