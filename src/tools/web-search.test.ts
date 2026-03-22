import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTool } from "./registry";

// Import to trigger registration
import "./web-search";

const mockContext = {
  renderInteractive: vi.fn().mockResolvedValue("approved"),
  reportProgress: vi.fn(),
  permissions: {},
};

const originalEnv = process.env.TAVILY_API_KEY;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  if (originalEnv !== undefined) {
    process.env.TAVILY_API_KEY = originalEnv;
  } else {
    delete process.env.TAVILY_API_KEY;
  }
  vi.restoreAllMocks();
});

describe("web_search tool", () => {
  it("is registered as non-interactive and disabled by default", () => {
    const tool = getTool("web_search");
    expect(tool).toBeDefined();
    expect(tool?.name).toBe("web_search");
    expect(tool?.interactive).toBe(false);
    expect(tool?.enabled).toBe(false);
  });

  it("returns error for empty query", async () => {
    process.env.TAVILY_API_KEY = "test-key";
    const tool = getTool("web_search");
    const result = await tool?.execute(
      JSON.stringify({ query: "" }),
      mockContext,
    );

    expect(result).toBe("Error: no search query provided");
  });

  it("returns error when TAVILY_API_KEY is not set", async () => {
    delete process.env.TAVILY_API_KEY;
    const tool = getTool("web_search");
    const result = await tool?.execute(
      JSON.stringify({ query: "test" }),
      mockContext,
    );

    expect(result).toContain("TAVILY_API_KEY");
  });

  it("warning returns message when API key is not set", () => {
    delete process.env.TAVILY_API_KEY;
    const tool = getTool("web_search");
    expect(tool?.warning?.()).toContain("TAVILY_API_KEY");
  });

  it("warning returns undefined when API key is set", () => {
    process.env.TAVILY_API_KEY = "test-key";
    const tool = getTool("web_search");
    expect(tool?.warning?.()).toBeUndefined();
  });

  it("returns formatted results on success", async () => {
    process.env.TAVILY_API_KEY = "test-key";
    const mockResponse = {
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
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const tool = getTool("web_search");
    const result = await tool?.execute(
      JSON.stringify({ query: "test query" }),
      mockContext,
    );

    expect(result).toContain("1. Test Result");
    expect(result).toContain("https://example.com");
    expect(result).toContain("A test snippet");
    expect(result).toContain("2. Another Result");
    expect(result).toContain("https://example.org");
  });

  it("returns message when no results found", async () => {
    process.env.TAVILY_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ results: [] }), { status: 200 }),
    );

    const tool = getTool("web_search");
    const result = await tool?.execute(
      JSON.stringify({ query: "obscure query" }),
      mockContext,
    );

    expect(result).toBe("No results found.");
  });

  it("returns error on 401 response", async () => {
    process.env.TAVILY_API_KEY = "bad-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Unauthorized", { status: 401 }),
    );

    const tool = getTool("web_search");
    const result = await tool?.execute(
      JSON.stringify({ query: "test" }),
      mockContext,
    );

    expect(result).toContain("invalid TAVILY_API_KEY");
  });

  it("returns error on 429 response", async () => {
    process.env.TAVILY_API_KEY = "test-key";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Rate limited", { status: 429 }),
    );

    const tool = getTool("web_search");
    const result = await tool?.execute(
      JSON.stringify({ query: "test" }),
      mockContext,
    );

    expect(result).toContain("rate limit");
  });
});
