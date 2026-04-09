import { afterEach, describe, expect, it, vi } from "vitest";
import { mockToolContext } from "../test-utils/stub-context";
import { webSearchTool } from "./web-search";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("webSearchTool", () => {
  it("has correct name and parameters", () => {
    expect(webSearchTool.name).toBe("web_search");
    expect(webSearchTool.parameters).toHaveProperty("properties");
    expect(webSearchTool.parameters).toHaveProperty("required");
  });

  describe("formatCall", () => {
    it("returns the query argument", () => {
      expect(webSearchTool.formatCall({ query: "how to foo" })).toBe(
        "how to foo",
      );
    });

    it("returns empty string when query is missing", () => {
      expect(webSearchTool.formatCall({})).toBe("");
    });
  });

  describe("execute", () => {
    it("returns error when no API key is configured or in env", async () => {
      vi.stubEnv("TAVILY_API_KEY", "");

      const result = await webSearchTool.execute(
        { query: "test" },
        mockToolContext(),
      );

      expect(result.status).toBe("error");
      expect(result.output).toContain("Tavily API key is not configured");
    });

    it("falls back to TAVILY_API_KEY env var when context key is not set", async () => {
      vi.stubEnv("TAVILY_API_KEY", "env-key");
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ results: [] }), { status: 200 }),
      );

      const result = await webSearchTool.execute(
        { query: "test" },
        mockToolContext(),
      );

      expect(result.status).toBe("ok");
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer env-key",
          }),
        }),
      );
    });

    it("prefers context API key over env var", async () => {
      vi.stubEnv("TAVILY_API_KEY", "env-key");
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ results: [] }), { status: 200 }),
      );

      await webSearchTool.execute(
        { query: "test" },
        mockToolContext({ webSearchApiKey: "config-key" }),
      );

      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer config-key",
          }),
        }),
      );
    });

    it("returns formatted results with answer on success", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            answer: "This is the summarised answer.",
            results: [
              {
                title: "Test Result",
                url: "https://example.com",
                content: "A test snippet",
                score: 0.9,
              },
              {
                title: "Another Result",
                url: "https://example.org",
                content: "Another snippet",
                score: 0.8,
              },
            ],
          }),
          { status: 200 },
        ),
      );

      const result = await webSearchTool.execute(
        { query: "test query" },
        mockToolContext({ webSearchApiKey: "test-key" }),
      );

      expect(result.status).toBe("ok");
      expect(result.output).toContain("Answer: This is the summarised answer.");
      expect(result.output).toContain("1. Test Result");
      expect(result.output).toContain("https://example.com");
      expect(result.output).toContain("A test snippet");
      expect(result.output).toContain("2. Another Result");
      expect(result.output).toContain("https://example.org");
    });

    it("returns results without answer when answer is absent", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(
          JSON.stringify({
            results: [
              {
                title: "Only Result",
                url: "https://example.com",
                content: "Snippet",
                score: 0.9,
              },
            ],
          }),
          { status: 200 },
        ),
      );

      const result = await webSearchTool.execute(
        { query: "test" },
        mockToolContext({ webSearchApiKey: "test-key" }),
      );

      expect(result.status).toBe("ok");
      expect(result.output).not.toContain("Answer:");
      expect(result.output).toContain("1. Only Result");
    });

    it("returns message when no results found", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ results: [] }), { status: 200 }),
      );

      const result = await webSearchTool.execute(
        { query: "obscure query" },
        mockToolContext({ webSearchApiKey: "test-key" }),
      );

      expect(result.status).toBe("ok");
      expect(result.output).toBe("No results found.");
    });

    it("returns error on 401 response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Unauthorized", { status: 401 }),
      );

      const result = await webSearchTool.execute(
        { query: "test" },
        mockToolContext({ webSearchApiKey: "bad-key" }),
      );

      expect(result.status).toBe("error");
      expect(result.output).toContain("Invalid Tavily API key");
    });

    it("returns error on 429 response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Rate limited", { status: 429 }),
      );

      const result = await webSearchTool.execute(
        { query: "test" },
        mockToolContext({ webSearchApiKey: "test-key" }),
      );

      expect(result.status).toBe("error");
      expect(result.output).toContain("rate limit");
    });

    it("returns error on other HTTP failures", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Server Error", { status: 500 }),
      );

      const result = await webSearchTool.execute(
        { query: "test" },
        mockToolContext({ webSearchApiKey: "test-key" }),
      );

      expect(result.status).toBe("error");
      expect(result.output).toContain("status 500");
    });

    it("sends correct request to Tavily API", async () => {
      const fetchSpy = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValue(
          new Response(JSON.stringify({ results: [] }), { status: 200 }),
        );

      await webSearchTool.execute(
        { query: "my search" },
        mockToolContext({ webSearchApiKey: "my-key" }),
      );

      expect(fetchSpy).toHaveBeenCalledWith("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer my-key",
        },
        body: JSON.stringify({
          query: "my search",
          max_results: 5,
          search_depth: "basic",
          include_answer: true,
        }),
      });
    });
  });
});
