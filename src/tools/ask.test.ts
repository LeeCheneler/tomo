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

  describe("validation", () => {
    it("accepts a question at the 200 character hard limit", async () => {
      const ask = vi.fn(async () => "ok");
      await expect(
        askTool.execute(
          { question: "x".repeat(200) },
          mockToolContext({ ask }),
        ),
      ).resolves.toMatchObject({ status: "ok" });
    });

    it("rejects a question longer than the 200 character hard limit", async () => {
      // Error references the soft target (175) shown to the LLM, even though
      // the hard validator limit is 200.
      await expect(
        askTool.execute({ question: "x".repeat(201) }, mockToolContext({})),
      ).rejects.toThrow(/175 characters/);
    });

    it("rejects a question containing a newline", async () => {
      await expect(
        askTool.execute(
          { question: "line one\nline two" },
          mockToolContext({}),
        ),
      ).rejects.toThrow(/single line/);
    });

    it("rejects a question containing a carriage return", async () => {
      await expect(
        askTool.execute(
          { question: "line one\rline two" },
          mockToolContext({}),
        ),
      ).rejects.toThrow(/single line/);
    });

    it("accepts an option label at the 80 character hard limit", async () => {
      const ask = vi.fn(async () => "x".repeat(80));
      await expect(
        askTool.execute(
          { question: "Pick one", options: ["x".repeat(80)] },
          mockToolContext({ ask }),
        ),
      ).resolves.toMatchObject({ status: "ok" });
    });

    it("rejects an option label longer than the 80 character hard limit", async () => {
      // Error references the soft target (60) shown to the LLM, even though
      // the hard validator limit is 80.
      await expect(
        askTool.execute(
          { question: "Pick one", options: ["x".repeat(81)] },
          mockToolContext({}),
        ),
      ).rejects.toThrow(/60 characters/);
    });
  });
});
