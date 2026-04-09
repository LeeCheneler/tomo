import { describe, expect, it, vi } from "vitest";
import { mockToolContext } from "../test-utils/stub-context";
import { askTool } from "./ask";

describe("askTool", () => {
  it("has correct name and parameters", () => {
    expect(askTool.name).toBe("ask");
    expect(askTool.parameters).toHaveProperty("properties");
    expect(askTool.parameters).toHaveProperty("required");
  });

  describe("formatCall", () => {
    it("returns the question argument", () => {
      expect(askTool.formatCall({ question: "Which one?" })).toBe("Which one?");
    });

    it("returns empty string when question is missing", () => {
      expect(askTool.formatCall({})).toBe("");
    });
  });

  describe("execute", () => {
    it("calls context.ask with question and options", async () => {
      const ask = vi.fn(async () => "option A");
      const result = await askTool.execute(
        { question: "Pick one", options: ["option A", "option B"] },
        mockToolContext({ ask }),
      );

      expect(ask).toHaveBeenCalledWith("Pick one", ["option A", "option B"]);
      expect(result.status).toBe("ok");
      expect(result.output).toBe("option A");
    });

    it("calls context.ask without options for open-ended questions", async () => {
      const ask = vi.fn(async () => "typed answer");
      const result = await askTool.execute(
        { question: "What do you think?" },
        mockToolContext({ ask }),
      );

      expect(ask).toHaveBeenCalledWith("What do you think?", undefined);
      expect(result.status).toBe("ok");
      expect(result.output).toBe("typed answer");
    });

    it("returns error when user cancels", async () => {
      const ask = vi.fn(async () => null);
      const result = await askTool.execute(
        { question: "Pick one" },
        mockToolContext({ ask }),
      );

      expect(result.status).toBe("error");
      expect(result.output).toContain("dismissed");
    });
  });
});
