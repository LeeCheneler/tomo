import { registerTool } from "./registry";
import type { ToolContext } from "./types";

const TAVILY_API_URL = "https://api.tavily.com/search";

registerTool({
  name: "web_search",
  description:
    "Search the web for current information. Returns titles, URLs, and snippets from search results.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query",
      },
    },
    required: ["query"],
  },
  interactive: false,
  enabled: false,
  warning: () =>
    process.env.TAVILY_API_KEY
      ? undefined
      : "TAVILY_API_KEY env var is not set",
  async execute(args: string, _context: ToolContext): Promise<string> {
    const parsed = JSON.parse(args);
    const query: string = parsed.query ?? "";

    if (!query.trim()) {
      return "Error: no search query provided";
    }

    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return "Error: TAVILY_API_KEY environment variable is not set. Set it to use web search.";
    }

    return search(query, apiKey);
  },
});

interface TavilyResult {
  title: string;
  url: string;
  content: string;
  score: number;
}

interface TavilyResponse {
  answer?: string;
  results: TavilyResult[];
}

async function search(query: string, apiKey: string): Promise<string> {
  const response = await fetch(TAVILY_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      max_results: 5,
      search_depth: "basic",
      include_answer: true,
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 401) {
      return "Error: invalid TAVILY_API_KEY. Check your API key.";
    }
    if (status === 429) {
      return "Error: Tavily rate limit exceeded. Try again later.";
    }
    return `Error: Tavily API returned status ${status}`;
  }

  const data = (await response.json()) as TavilyResponse;

  if (!data.results || data.results.length === 0) {
    return "No results found.";
  }

  const parts: string[] = [];

  if (data.answer) {
    parts.push(`Answer: ${data.answer}`);
  }

  parts.push(
    ...data.results.map(
      (r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.content}`,
    ),
  );

  return parts.join("\n\n");
}
