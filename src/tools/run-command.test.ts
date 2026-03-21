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

  it("returns error when no command provided", async () => {
    const tool = getTool("run_command");
    const context = { renderInteractive: vi.fn() };

    const result = await tool?.execute(
      JSON.stringify({ command: "" }),
      context,
    );
    expect(result).toBe("Error: no command provided");
    expect(context.renderInteractive).not.toHaveBeenCalled();
  });

  it("calls renderInteractive for confirmation", async () => {
    const tool = getTool("run_command");
    const context = {
      renderInteractive: vi.fn().mockResolvedValue("approved"),
    };

    const result = await tool?.execute(
      JSON.stringify({ command: "echo hello" }),
      context,
    );

    expect(context.renderInteractive).toHaveBeenCalledTimes(1);
    expect(result).toContain("Exit code: 0");
    expect(result).toContain("hello");
  });

  it("returns denial message when user denies via cancel", async () => {
    const tool = getTool("run_command");
    const context = {
      renderInteractive: vi.fn().mockResolvedValue("denied"),
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
