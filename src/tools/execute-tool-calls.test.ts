import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { ToolCall } from "../provider/client";
import type { ChatMessage } from "../chat/message";
import { mockToolContext } from "../test-utils/stub-context";
import { createToolRegistry } from "./registry";
import { denied, err, ok, okDiff } from "./types";
import { executeToolCalls } from "./execute-tool-calls";

/** Creates a minimal tool call from the LLM. */
function stubToolCall(name: string, args: string, id?: string): ToolCall {
  return {
    id: id ?? `call_${name}`,
    type: "function",
    function: { name, arguments: args },
  };
}

describe("executeToolCalls", () => {
  it("produces a tool-call message followed by a tool-result message", async () => {
    const registry = createToolRegistry();
    registry.register({
      name: "greet",
      displayName: "Greet",
      description: "Says hello",
      parameters: { type: "object", properties: {} },
      argsSchema: z.object({}),
      formatCall: () => "",
      execute: async () => ok("hello!"),
    });

    const messages = await executeToolCalls(
      [stubToolCall("greet", "{}")],
      "assistant text",
      registry,
      mockToolContext(),
    );

    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe("tool-call");
    expect(messages[1]?.role).toBe("tool-result");
  });

  it("includes assistant content in the tool-call message", async () => {
    const registry = createToolRegistry();
    registry.register({
      name: "test",
      displayName: "Test",
      description: "test",
      parameters: { type: "object", properties: {} },
      argsSchema: z.object({}),
      formatCall: () => "",
      execute: async () => ok("done"),
    });

    const messages = await executeToolCalls(
      [stubToolCall("test", "{}")],
      "thinking out loud",
      registry,
      mockToolContext(),
    );

    const callMsg = messages[0] as ChatMessage & { role: "tool-call" };
    expect(callMsg.content).toBe("thinking out loud");
  });

  it("builds tool call summary via formatCall", async () => {
    const registry = createToolRegistry();
    registry.register({
      name: "read_file",
      displayName: "Read File",
      description: "reads",
      parameters: { type: "object", properties: {} },
      argsSchema: z.object({ path: z.string() }),
      formatCall: (args) => String(args.path ?? ""),
      execute: async () => ok("content"),
    });

    const messages = await executeToolCalls(
      [stubToolCall("read_file", '{"path":"./foo.ts"}')],
      "",
      registry,
      mockToolContext(),
    );

    const callMsg = messages[0] as ChatMessage & { role: "tool-call" };
    expect(callMsg.toolCalls[0]?.summary).toBe("./foo.ts");
  });

  it("handles invalid JSON in arguments gracefully for formatCall", async () => {
    const registry = createToolRegistry();
    registry.register({
      name: "test",
      displayName: "Test",
      description: "test",
      parameters: { type: "object", properties: {} },
      argsSchema: z.object({}),
      formatCall: () => "should not be called",
      execute: async () => ok("done"),
    });

    const messages = await executeToolCalls(
      [stubToolCall("test", "not json")],
      "",
      registry,
      mockToolContext(),
    );

    const callMsg = messages[0] as ChatMessage & { role: "tool-call" };
    expect(callMsg.toolCalls[0]?.summary).toBe("");
  });

  it("returns error result for unknown tools", async () => {
    const registry = createToolRegistry();
    const messages = await executeToolCalls(
      [stubToolCall("nonexistent", "{}")],
      "",
      registry,
      mockToolContext(),
    );

    expect(messages).toHaveLength(2);
    const result = messages[1] as ChatMessage & { role: "tool-result" };
    expect(result.status).toBe("error");
    expect(result.output).toContain("Unknown tool: nonexistent");
    expect(result.format).toBe("plain");
  });

  it("uses displayName from registry, falls back to tool name for unknown tools", async () => {
    const registry = createToolRegistry();
    const messages = await executeToolCalls(
      [stubToolCall("mystery", "{}")],
      "",
      registry,
      mockToolContext(),
    );

    const callMsg = messages[0] as ChatMessage & { role: "tool-call" };
    expect(callMsg.toolCalls[0]?.displayName).toBe("mystery");
  });

  it("passes through status and format from tool result", async () => {
    const registry = createToolRegistry();
    registry.register({
      name: "diff_tool",
      displayName: "Diff",
      description: "returns diff",
      parameters: { type: "object", properties: {} },
      argsSchema: z.object({}),
      formatCall: () => "",
      execute: async () => okDiff("+added"),
    });

    const messages = await executeToolCalls(
      [stubToolCall("diff_tool", "{}")],
      "",
      registry,
      mockToolContext(),
    );

    const result = messages[1] as ChatMessage & { role: "tool-result" };
    expect(result.status).toBe("ok");
    expect(result.format).toBe("diff");
    expect(result.output).toBe("+added");
  });

  it("passes through denied status", async () => {
    const registry = createToolRegistry();
    registry.register({
      name: "deny_tool",
      displayName: "Deny",
      description: "always denied",
      parameters: { type: "object", properties: {} },
      argsSchema: z.object({}),
      formatCall: () => "",
      execute: async () => denied("nope"),
    });

    const messages = await executeToolCalls(
      [stubToolCall("deny_tool", "{}")],
      "",
      registry,
      mockToolContext(),
    );

    const result = messages[1] as ChatMessage & { role: "tool-result" };
    expect(result.status).toBe("denied");
  });

  it("passes through error status", async () => {
    const registry = createToolRegistry();
    registry.register({
      name: "err_tool",
      displayName: "Err",
      description: "always errors",
      parameters: { type: "object", properties: {} },
      argsSchema: z.object({}),
      formatCall: () => "",
      execute: async () => err("bad input"),
    });

    const messages = await executeToolCalls(
      [stubToolCall("err_tool", "{}")],
      "",
      registry,
      mockToolContext(),
    );

    const result = messages[1] as ChatMessage & { role: "tool-result" };
    expect(result.status).toBe("error");
    expect(result.output).toBe("bad input");
  });

  it("catches exceptions from tool execute and returns error", async () => {
    const registry = createToolRegistry();
    registry.register({
      name: "exploding",
      displayName: "Exploding",
      description: "throws",
      parameters: { type: "object", properties: {} },
      argsSchema: z.object({}),
      formatCall: () => "",
      execute: async () => {
        throw new Error("kaboom");
      },
    });

    const messages = await executeToolCalls(
      [stubToolCall("exploding", "{}")],
      "",
      registry,
      mockToolContext(),
    );

    const result = messages[1] as ChatMessage & { role: "tool-result" };
    expect(result.status).toBe("error");
    expect(result.output).toContain("kaboom");
  });

  it("returns interleaved call-result pairs for multiple tools", async () => {
    const order: string[] = [];
    const registry = createToolRegistry();
    registry.register({
      name: "first",
      displayName: "First",
      description: "first",
      parameters: { type: "object", properties: {} },
      argsSchema: z.object({}),
      formatCall: () => "",
      execute: async () => {
        order.push("first");
        return ok("one");
      },
    });
    registry.register({
      name: "second",
      displayName: "Second",
      description: "second",
      parameters: { type: "object", properties: {} },
      argsSchema: z.object({}),
      formatCall: () => "",
      execute: async () => {
        order.push("second");
        return ok("two");
      },
    });

    const messages = await executeToolCalls(
      [stubToolCall("first", "{}"), stubToolCall("second", "{}")],
      "",
      registry,
      mockToolContext(),
    );

    // Interleaved: [call1, result1, call2, result2]
    expect(messages).toHaveLength(4);
    expect(messages[0]?.role).toBe("tool-call");
    expect(messages[1]?.role).toBe("tool-result");
    expect(messages[2]?.role).toBe("tool-call");
    expect(messages[3]?.role).toBe("tool-result");
    expect(order).toContain("first");
    expect(order).toContain("second");
  });

  it("passes tool context through to execute", async () => {
    const confirm = vi.fn(async () => true);
    const registry = createToolRegistry();
    registry.register({
      name: "confirming",
      displayName: "Confirming",
      description: "asks",
      parameters: { type: "object", properties: {} },
      argsSchema: z.object({}),
      formatCall: () => "",
      execute: async (_args, ctx) => {
        const approved = await ctx.confirm("ok?");
        return ok(approved ? "yes" : "no");
      },
    });

    const messages = await executeToolCalls(
      [stubToolCall("confirming", "{}")],
      "",
      registry,
      mockToolContext({ confirm }),
    );

    expect(confirm).toHaveBeenCalledOnce();
    const result = messages[1] as ChatMessage & { role: "tool-result" };
    expect(result.output).toBe("yes");
  });

  it("calls onToolComplete for each tool as it finishes", async () => {
    const registry = createToolRegistry();
    registry.register({
      name: "fast",
      displayName: "Fast",
      description: "fast",
      parameters: { type: "object", properties: {} },
      argsSchema: z.object({}),
      formatCall: () => "",
      execute: async () => ok("quick"),
    });
    registry.register({
      name: "slow",
      displayName: "Slow",
      description: "slow",
      parameters: { type: "object", properties: {} },
      argsSchema: z.object({}),
      formatCall: () => "",
      execute: async () => {
        await new Promise((r) => setTimeout(r, 50));
        return ok("done");
      },
    });

    const completions: Array<[string, string, string]> = [];
    const onToolComplete = (
      toolCallId: string,
      callMsg: ChatMessage,
      resultMsg: ChatMessage,
    ) => {
      completions.push([toolCallId, callMsg.role, resultMsg.role]);
    };

    await executeToolCalls(
      [stubToolCall("fast", "{}"), stubToolCall("slow", "{}")],
      "",
      registry,
      mockToolContext(),
      undefined,
      onToolComplete,
    );

    // Both tools should have completed individually with their IDs.
    expect(completions).toHaveLength(2);
    expect(completions[0]).toEqual(["call_fast", "tool-call", "tool-result"]);
    expect(completions[1]).toEqual(["call_slow", "tool-call", "tool-result"]);
  });
});
