import type { ToolCall } from "../provider/client";
import type { ChatMessage } from "../chat/message";
import type { ToolRegistry } from "./registry";
import type { ToolContext } from "./types";
import { parseToolArgs } from "./types";

/** Callback to emit a message as it's produced (for incremental UI updates). */
export type OnMessage = (message: ChatMessage) => void;

/**
 * Executes a batch of tool calls from the LLM and returns the resulting display messages.
 *
 * Produces a ToolCallMessage followed by a ToolResultMessage for each call.
 * Each message is emitted via `onMessage` as it's created so the UI can
 * update incrementally rather than waiting for the entire batch.
 */
export async function executeToolCalls(
  toolCalls: ToolCall[],
  assistantContent: string,
  registry: ToolRegistry,
  context: ToolContext,
  onMessage: OnMessage,
): Promise<ChatMessage[]> {
  const messages: ChatMessage[] = [];

  /** Appends a message to the local list and emits it. */
  function emit(msg: ChatMessage) {
    messages.push(msg);
    onMessage(msg);
  }

  const toolCallMsg: ChatMessage = {
    id: crypto.randomUUID(),
    role: "tool-call",
    content: assistantContent,
    toolCalls: toolCalls.map((tc) => {
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
    }),
  };
  emit(toolCallMsg);

  for (const tc of toolCalls) {
    const tool = registry.get(tc.function.name);
    if (!tool) {
      emit({
        id: crypto.randomUUID(),
        role: "tool-result",
        toolCallId: tc.id,
        toolName: tc.function.name,
        output: `Unknown tool: ${tc.function.name}`,
        status: "error",
        format: "plain",
      });
      continue;
    }

    let output: string;
    let status: "ok" | "error" | "denied" = "ok";
    let format: "plain" | "diff" = "plain";
    try {
      const parsed = parseToolArgs(tool.argsSchema, tc.function.arguments);
      const result = await tool.execute(parsed, context);
      output = result.output;
      status = result.status;
      format = result.format;
    } catch (e) {
      output = `Tool error: ${e instanceof Error ? e.message : "unknown error"}`;
      status = "error";
    }

    emit({
      id: crypto.randomUUID(),
      role: "tool-result",
      toolCallId: tc.id,
      toolName: tc.function.name,
      output,
      status,
      format,
    });
  }

  return messages;
}
