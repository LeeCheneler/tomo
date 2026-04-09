import { z } from "zod";
import { env } from "../utils/env";
import type { Tool, ToolContext, ToolResult } from "./types";
import { err, ok } from "./types";

/** Tavily search API endpoint. */
const TAVILY_API_URL = "https://api.tavily.com/search";

/** Zod schema for web_search arguments. */
const argsSchema = z.object({
  query: z.string().min(1, "no search query provided"),
});

/** Zod schema for a single Tavily search result. */
const tavilyResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  content: z.string(),
  score: z.number(),
});

/** Zod schema for the Tavily search API response. */
const tavilyResponseSchema = z.object({
  answer: z.string().optional(),
  results: z.array(tavilyResultSchema),
});

/** Calls the Tavily search API and formats the results. */
async function search(query: string, apiKey: string): Promise<ToolResult> {
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
      return err("Invalid Tavily API key. Check your configuration.");
    }
    if (status === 429) {
      return err("Tavily rate limit exceeded. Try again later.");
    }
    return err(`Tavily API returned status ${status}`);
  }

  const data = tavilyResponseSchema.parse(await response.json());

  if (!data.results || data.results.length === 0) {
    return ok("No results found.");
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

  return ok(parts.join("\n\n"));
}

/** The web_search tool definition. */
export const webSearchTool: Tool = {
  name: "web_search",
  displayName: "Web Search",
  description: `Search the web for current information. Returns up to 5 results with titles, URLs, and content snippets.

- Use for information that is not available in the codebase: library documentation, API references, error messages, recent changes.
- Do not use for questions answerable from the code itself — use grep or read_file instead.
- Requires a Tavily API key to be configured in settings.`,
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
  argsSchema,
  formatCall(args: Record<string, unknown>): string {
    return String(args.query ?? "");
  },
  async execute(args: unknown, context: ToolContext): Promise<ToolResult> {
    const parsed = argsSchema.parse(args);
    const apiKey = context.webSearchApiKey ?? env.getOptional("TAVILY_API_KEY");

    if (!apiKey) {
      return err(
        "Tavily API key is not configured. Set it in /settings under Web Search, or set the TAVILY_API_KEY environment variable.",
      );
    }

    return search(parsed.query, apiKey);
  },
};
