# Epic 5 — Web Search Tool

Build a local web search capability using DuckDuckGo scraping and register it with the tool system from Epic 4.

**Depends on:** Epic 4 (Tool System)

## Tickets

### E5-01: DuckDuckGo scraper

Build the search scraper. Send a GET request to `https://lite.duckduckgo.com/lite` with the query as a form parameter. Parse the HTML response to extract result entries (title, URL, snippet). Return as a structured array. Handle rate limiting, errors, and empty results.

Acceptance criteria:

- Returns structured results for a given query
- Handles network errors and empty results gracefully
- Parses at least title, URL, and snippet per result
- Works without any API keys or external dependencies
- Unit tests cover parsing logic (use fixture HTML responses)

---

### E5-02: `web_search` tool handler

Register the `web_search` tool with the registry. Schema takes a `query` string parameter. Handler calls the DDG scraper and formats results as readable text content for the model (e.g. numbered list of title + URL + snippet).

Acceptance criteria:

- Tool is registered and appears in provider requests
- Model can invoke `web_search` with a query
- Results are returned to the model in a format it can reason over
- End-to-end: ask the model a question requiring search, it calls the tool, gets results, synthesises an answer
