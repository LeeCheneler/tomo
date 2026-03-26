import { describe, expect, it, vi } from "vitest";
import { getTool } from "./registry";
import type { ToolContext } from "./types";

// Import to trigger registration
import "./run-command";

vi.mock("../config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../config")>();
  return {
    ...actual,
    addAllowedCommand: vi.fn(),
  };
});

function makeContext(overrides?: Partial<ToolContext>): ToolContext {
  return {
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
    commandPatterns: [],
    allowedCommands: [],
    ...overrides,
  };
}

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
    const context = makeContext();

    await expect(
      tool?.execute(JSON.stringify({ command: "" }), context),
    ).rejects.toThrow("no command provided");
    expect(context.renderInteractive).not.toHaveBeenCalled();
  });
});

describe("approval flow", () => {
  it("auto-approves commands in allowedCommands", async () => {
    const tool = getTool("run_command");
    const context = makeContext({
      allowedCommands: ["echo hello"],
    });

    const result = await tool?.execute(
      JSON.stringify({ command: "echo hello" }),
      context,
    );

    expect(context.renderInteractive).not.toHaveBeenCalled();
    expect(result).toContain("echo hello");
    expect(result).toContain("Exit code: 0");
  });

  it("auto-approves commands matching an enabled pattern", async () => {
    const tool = getTool("run_command");
    const context = makeContext({
      commandPatterns: [{ pattern: "echo *", enabled: true }],
    });

    const result = await tool?.execute(
      JSON.stringify({ command: "echo hello" }),
      context,
    );

    expect(context.renderInteractive).not.toHaveBeenCalled();
    expect(result).toContain("echo hello");
  });

  it("does not auto-approve with disabled pattern", async () => {
    const tool = getTool("run_command");
    const context = makeContext({
      commandPatterns: [{ pattern: "echo *", enabled: false }],
    });

    await tool?.execute(JSON.stringify({ command: "echo hello" }), context);

    expect(context.renderInteractive).toHaveBeenCalled();
  });

  it("skips patterns for compound commands", async () => {
    const tool = getTool("run_command");
    const context = makeContext({
      commandPatterns: [{ pattern: "echo *", enabled: true }],
    });

    await tool?.execute(
      JSON.stringify({ command: "echo a && echo b" }),
      context,
    );

    expect(context.renderInteractive).toHaveBeenCalled();
  });

  it("prompts with destructive warning for destructive commands", async () => {
    const tool = getTool("run_command");
    const context = makeContext({
      renderInteractive: vi.fn().mockResolvedValue("approved"),
      commandPatterns: [{ pattern: "rm *", enabled: true }],
    });

    await tool?.execute(
      JSON.stringify({ command: "rm -rf /tmp/test" }),
      context,
    );

    expect(context.renderInteractive).toHaveBeenCalled();
  });

  it("destructive commands prompt even with run_command permission", async () => {
    const tool = getTool("run_command");
    const context = makeContext({
      permissions: { run_command: true },
      renderInteractive: vi.fn().mockResolvedValue("approved"),
    });

    await tool?.execute(
      JSON.stringify({ command: "rm -rf /tmp/test" }),
      context,
    );

    expect(context.renderInteractive).toHaveBeenCalled();
  });

  it("auto-approves with global run_command permission for non-destructive commands", async () => {
    const tool = getTool("run_command");
    const context = makeContext({
      permissions: { run_command: true },
    });

    const result = await tool?.execute(
      JSON.stringify({ command: "echo hello" }),
      context,
    );

    expect(context.renderInteractive).not.toHaveBeenCalled();
    expect(result).toContain("echo hello");
  });

  it("prompts when no patterns match and no permission granted", async () => {
    const tool = getTool("run_command");
    const context = makeContext();

    await tool?.execute(JSON.stringify({ command: "echo hello" }), context);

    expect(context.renderInteractive).toHaveBeenCalled();
  });

  it("returns denial message when user denies", async () => {
    const tool = getTool("run_command");
    const context = makeContext({
      renderInteractive: vi.fn().mockResolvedValue("denied"),
    });

    const result = await tool?.execute(
      JSON.stringify({ command: "echo hello" }),
      context,
    );

    expect(result).toBe("The user denied this command.");
  });

  it("persists command on approve always", async () => {
    const { addAllowedCommand } = await import("../config");
    const tool = getTool("run_command");
    const context = makeContext({
      renderInteractive: vi.fn().mockResolvedValue("approved_always"),
    });

    const result = await tool?.execute(
      JSON.stringify({ command: "echo hello" }),
      context,
    );

    expect(addAllowedCommand).toHaveBeenCalledWith("echo hello");
    expect(result).toContain("echo hello");
    expect(result).toContain("Exit code: 0");
  });

  it("allowed_commands bypasses destructive check", async () => {
    const tool = getTool("run_command");
    const context = makeContext({
      allowedCommands: ["rm -rf /tmp/test"],
    });

    const result = await tool?.execute(
      JSON.stringify({ command: "rm -rf /tmp/test" }),
      context,
    );

    expect(context.renderInteractive).not.toHaveBeenCalled();
    expect(result).toContain("rm -rf /tmp/test");
  });
});

describe("command execution", () => {
  it("streams output via reportProgress", async () => {
    const tool = getTool("run_command");
    const context = makeContext({
      allowedCommands: ["echo hello"],
    });

    await tool?.execute(JSON.stringify({ command: "echo hello" }), context);

    const rp = context.reportProgress as ReturnType<typeof vi.fn>;
    expect(rp).toHaveBeenCalled();
    const lastCall = rp.mock.calls[rp.mock.calls.length - 1];
    expect(lastCall[0]).toBe("");
  });

  it("captures stderr and non-zero exit codes", async () => {
    const tool = getTool("run_command");
    const context = makeContext({
      renderInteractive: vi.fn().mockResolvedValue("approved"),
    });

    const result = await tool?.execute(
      JSON.stringify({ command: "echo err >&2 && exit 1" }),
      context,
    );

    expect(result).toContain("Exit code: 1");
    expect(result).toContain("stderr:");
    expect(result).toContain("err");
  });
});
