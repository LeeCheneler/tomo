import { describe, expect, it, vi } from "vitest";
import { getTool } from "./registry";

// Import to trigger registration
import "./ask";

describe("ask tool", () => {
  it("is registered in the tool registry", () => {
    const tool = getTool("ask");
    expect(tool).toBeDefined();
    expect(tool?.name).toBe("ask");
  });

  it("has correct parameter schema", () => {
    const tool = getTool("ask");
    expect(tool?.parameters).toEqual({
      type: "object",
      properties: {
        question: {
          type: "string",
          description: "The question to ask the user",
        },
        options: {
          type: "array",
          items: { type: "string" },
          description: "The available choices (2 or more)",
        },
      },
      required: ["question", "options"],
    });
  });

  it("returns error when no options provided", async () => {
    const tool = getTool("ask");
    const context = {
      renderInteractive: vi.fn(),
      reportProgress: vi.fn(),
    };

    const result = await tool?.execute(
      JSON.stringify({ question: "pick", options: [] }),
      context,
    );
    expect(result).toBe("Error: no options provided");
    expect(context.renderInteractive).not.toHaveBeenCalled();
  });

  it("uses default question when none provided", async () => {
    const tool = getTool("ask");
    const context = {
      reportProgress: vi.fn(),
      renderInteractive: vi.fn().mockResolvedValue("A"),
    };

    await tool?.execute(JSON.stringify({ options: ["A", "B"] }), context);

    // Factory should be called (renderInteractive was invoked)
    expect(context.renderInteractive).toHaveBeenCalledTimes(1);
  });

  it("calls renderInteractive with a factory function", async () => {
    const tool = getTool("ask");
    const context = {
      reportProgress: vi.fn(),
      renderInteractive: vi.fn().mockResolvedValue("option A"),
    };

    const result = await tool?.execute(
      JSON.stringify({ question: "pick one", options: ["A", "B"] }),
      context,
    );

    expect(context.renderInteractive).toHaveBeenCalledTimes(1);
    expect(typeof context.renderInteractive.mock.calls[0][0]).toBe("function");
    expect(result).toBe("option A");
  });
});
