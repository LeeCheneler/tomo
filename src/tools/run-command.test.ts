import { describe, expect, it, vi } from "vitest";
import { getTool } from "./registry";

// Import to trigger registration
import "./run-command";

describe("run_command tool", () => {
  it("is registered in the tool registry", () => {
    const tool = getTool("run_command");
    expect(tool).toBeDefined();
    expect(tool?.name).toBe("run_command");
  });

  it("has correct parameter schema", () => {
    const tool = getTool("run_command");
    expect(tool?.parameters).toEqual({
      type: "object",
      properties: {
        command: {
          type: "string",
          description: "The shell command to execute",
        },
      },
      required: ["command"],
    });
  });

  it("throws when no command provided", async () => {
    const tool = getTool("run_command");
    const context = {
      renderInteractive: vi.fn(),
      reportProgress: vi.fn(),
      permissions: {},
      signal: new AbortController().signal,
      depth: 0,
      providerConfig: {
        baseUrl: "http://localhost",
        model: "test-model",
        apiKey: undefined,
        maxTokens: 1024,
        contextWindow: 8192,
      },
    };

    await expect(
      tool?.execute(JSON.stringify({ command: "" }), context),
    ).rejects.toThrow("no command provided");
    expect(context.renderInteractive).not.toHaveBeenCalled();
  });

  it("calls renderInteractive for confirmation", async () => {
    const tool = getTool("run_command");
    const context = {
      renderInteractive: vi.fn().mockResolvedValue("approved"),
      reportProgress: vi.fn(),
      permissions: {},
      signal: new AbortController().signal,
      depth: 0,
      providerConfig: {
        baseUrl: "http://localhost",
        model: "test-model",
        apiKey: undefined,
        maxTokens: 1024,
        contextWindow: 8192,
      },
    };

    const result = await tool?.execute(
      JSON.stringify({ command: "echo hello" }),
      context,
    );

    expect(context.renderInteractive).toHaveBeenCalledTimes(1);
    expect(result).toContain("$ echo hello");
    expect(result).toContain("Exit code: 0");
    expect(result).toContain("hello");
  });

  it("streams output via reportProgress during execution", async () => {
    const tool = getTool("run_command");
    const context = {
      renderInteractive: vi.fn().mockResolvedValue("approved"),
      reportProgress: vi.fn(),
      permissions: {},
      signal: new AbortController().signal,
      depth: 0,
      providerConfig: {
        baseUrl: "http://localhost",
        model: "test-model",
        apiKey: undefined,
        maxTokens: 1024,
        contextWindow: 8192,
      },
    };

    await tool?.execute(JSON.stringify({ command: "echo hello" }), context);

    // reportProgress should have been called with partial output, then cleared
    expect(context.reportProgress).toHaveBeenCalled();
    // Last call clears streaming content
    const lastCall =
      context.reportProgress.mock.calls[
        context.reportProgress.mock.calls.length - 1
      ];
    expect(lastCall[0]).toBe("");
  });

  it("returns denial message when user denies via cancel", async () => {
    const tool = getTool("run_command");
    const context = {
      renderInteractive: vi.fn().mockResolvedValue("denied"),
      reportProgress: vi.fn(),
      permissions: {},
      signal: new AbortController().signal,
      depth: 0,
      providerConfig: {
        baseUrl: "http://localhost",
        model: "test-model",
        apiKey: undefined,
        maxTokens: 1024,
        contextWindow: 8192,
      },
    };

    const result = await tool?.execute(
      JSON.stringify({ command: "echo hello" }),
      context,
    );

    expect(result).toBe("The user denied this command.");
  });

  it("captures stderr and non-zero exit codes", async () => {
    const tool = getTool("run_command");
    const context = {
      renderInteractive: vi.fn().mockResolvedValue("approved"),
      reportProgress: vi.fn(),
      permissions: {},
      signal: new AbortController().signal,
      depth: 0,
      providerConfig: {
        baseUrl: "http://localhost",
        model: "test-model",
        apiKey: undefined,
        maxTokens: 1024,
        contextWindow: 8192,
      },
    };

    const result = await tool?.execute(
      JSON.stringify({ command: "echo err >&2 && exit 1" }),
      context,
    );

    expect(result).toContain("Exit code: 1");
    expect(result).toContain("stderr:");
    expect(result).toContain("err");
  });

  it("returns exit code and output for failed commands", async () => {
    const tool = getTool("run_command");
    const context = {
      renderInteractive: vi.fn().mockResolvedValue("approved"),
      reportProgress: vi.fn(),
      permissions: {},
      signal: new AbortController().signal,
      depth: 0,
      providerConfig: {
        baseUrl: "http://localhost",
        model: "test-model",
        apiKey: undefined,
        maxTokens: 1024,
        contextWindow: 8192,
      },
    };

    const result = await tool?.execute(
      JSON.stringify({ command: "echo out && echo err >&2 && exit 2" }),
      context,
    );

    expect(result).toContain("Exit code: 2");
    expect(result).toContain("out");
    expect(result).toContain("err");
  });
});
