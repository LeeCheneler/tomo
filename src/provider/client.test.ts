import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  type ChatMessage,
  clearContextWindowCache,
  fetchContextWindow,
  fetchModels,
  resolveApiKey,
  streamChatCompletion,
} from "./client";

function createSSEResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

function makeChunk(content: string): string {
  return JSON.stringify({
    id: "chatcmpl-1",
    object: "chat.completion.chunk",
    created: 1234567890,
    model: "test-model",
    choices: [{ index: 0, delta: { content }, finish_reason: null }],
  });
}

function makeUsageChunk(
  promptTokens: number,
  completionTokens: number,
): string {
  return JSON.stringify({
    id: "chatcmpl-1",
    object: "chat.completion.chunk",
    created: 1234567890,
    model: "test-model",
    choices: [],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  });
}

const defaultOptions = {
  baseUrl: "http://localhost:11434",
  model: "test-model",
  messages: [{ role: "user" as const, content: "Hello" }],
};

describe("streamChatCompletion", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("yields content tokens from streaming response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createSSEResponse([
        `data: ${makeChunk("Hello")}\n\ndata: ${makeChunk(" world")}\n\ndata: [DONE]\n\n`,
      ]),
    );

    const completion = await streamChatCompletion(defaultOptions);
    const tokens: string[] = [];
    for await (const token of completion.content) {
      tokens.push(token);
    }

    expect(tokens).toEqual(["Hello", " world"]);
  });

  it("sends correct request with stream_options", async () => {
    vi.mocked(fetch).mockResolvedValue(createSSEResponse(["data: [DONE]\n\n"]));

    const messages: ChatMessage[] = [
      { role: "system", content: "You are helpful" },
      { role: "user", content: "Hi" },
    ];

    const completion = await streamChatCompletion({
      baseUrl: "http://localhost:11434",
      model: "llama3",
      messages,
    });
    for await (const _ of completion.content) {
      // consume
    }

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://localhost:11434/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "llama3",
          messages,
          stream: true,
          stream_options: { include_usage: true },
        }),
      }),
    );
  });

  it("strips trailing slashes from baseUrl", async () => {
    vi.mocked(fetch).mockResolvedValue(createSSEResponse(["data: [DONE]\n\n"]));

    const completion = await streamChatCompletion({
      ...defaultOptions,
      baseUrl: "http://localhost:11434/",
    });
    for await (const _ of completion.content) {
      // consume
    }

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://localhost:11434/v1/chat/completions",
      expect.anything(),
    );
  });

  it("throws on HTTP error response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("Internal Server Error", { status: 500 }),
    );

    await expect(streamChatCompletion(defaultOptions)).rejects.toThrow(
      "Provider returned HTTP 500: Internal Server Error",
    );
  });

  it("throws on connection failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("fetch failed"));

    await expect(streamChatCompletion(defaultOptions)).rejects.toThrow(
      "Failed to connect to provider",
    );
  });

  it("skips chunks with no content (e.g. role-only delta)", async () => {
    const roleChunk = JSON.stringify({
      id: "1",
      object: "chat.completion.chunk",
      created: 1,
      model: "test",
      choices: [
        { index: 0, delta: { role: "assistant" }, finish_reason: null },
      ],
    });
    vi.mocked(fetch).mockResolvedValue(
      createSSEResponse([
        `data: ${roleChunk}\n\ndata: ${makeChunk("Hi")}\n\ndata: [DONE]\n\n`,
      ]),
    );

    const completion = await streamChatCompletion(defaultOptions);
    const tokens: string[] = [];
    for await (const token of completion.content) {
      tokens.push(token);
    }

    expect(tokens).toEqual(["Hi"]);
  });

  it("passes abort signal to fetch", async () => {
    const controller = new AbortController();
    controller.abort();

    vi.mocked(fetch).mockRejectedValue(
      new DOMException("The operation was aborted", "AbortError"),
    );

    await expect(
      streamChatCompletion({
        ...defaultOptions,
        signal: controller.signal,
      }),
    ).rejects.toThrow("aborted");
  });

  it("throws on empty response body", async () => {
    const response = new Response(null, { status: 200 });
    Object.defineProperty(response, "body", { value: null });
    vi.mocked(fetch).mockResolvedValue(response);

    await expect(streamChatCompletion(defaultOptions)).rejects.toThrow(
      "Provider returned an empty response body",
    );
  });

  it("extracts token usage from the final chunk", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createSSEResponse([
        `data: ${makeChunk("Hi")}\n\ndata: ${makeUsageChunk(25, 10)}\n\ndata: [DONE]\n\n`,
      ]),
    );

    const completion = await streamChatCompletion(defaultOptions);
    for await (const _ of completion.content) {
      // consume
    }

    expect(completion.getUsage()).toEqual({
      promptTokens: 25,
      completionTokens: 10,
    });
  });

  it("returns null usage when provider sends no usage chunk", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createSSEResponse([`data: ${makeChunk("Hi")}\n\ndata: [DONE]\n\n`]),
    );

    const completion = await streamChatCompletion(defaultOptions);
    for await (const _ of completion.content) {
      // consume
    }

    expect(completion.getUsage()).toBeNull();
  });

  it("returns empty tool calls when response has none", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createSSEResponse([`data: ${makeChunk("Hi")}\n\ndata: [DONE]\n\n`]),
    );

    const completion = await streamChatCompletion(defaultOptions);
    for await (const _ of completion.content) {
      // consume
    }

    expect(completion.getToolCalls()).toEqual([]);
  });

  it("accumulates tool_calls deltas across chunks", async () => {
    const chunk1 = JSON.stringify({
      id: "chatcmpl-1",
      object: "chat.completion.chunk",
      created: 1,
      model: "test",
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                id: "call-1",
                function: { name: "ask", arguments: '{"q' },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    });
    const chunk2 = JSON.stringify({
      id: "chatcmpl-1",
      object: "chat.completion.chunk",
      created: 1,
      model: "test",
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              { index: 0, function: { arguments: 'uestion":"hi"}' } },
            ],
          },
          finish_reason: null,
        },
      ],
    });

    vi.mocked(fetch).mockResolvedValue(
      createSSEResponse([
        `data: ${chunk1}\n\ndata: ${chunk2}\n\ndata: [DONE]\n\n`,
      ]),
    );

    const completion = await streamChatCompletion(defaultOptions);
    for await (const _ of completion.content) {
      // consume
    }

    expect(completion.getToolCalls()).toEqual([
      {
        id: "call-1",
        type: "function",
        function: { name: "ask", arguments: '{"question":"hi"}' },
      },
    ]);
  });

  it("sends tools in request body when provided", async () => {
    vi.mocked(fetch).mockResolvedValue(createSSEResponse(["data: [DONE]\n\n"]));

    const tools = [
      {
        type: "function" as const,
        function: {
          name: "ask",
          description: "Ask a question",
          parameters: { type: "object", properties: {} },
        },
      },
    ];

    const completion = await streamChatCompletion({
      ...defaultOptions,
      tools,
    });
    for await (const _ of completion.content) {
      // consume
    }

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(body.tools).toEqual(tools);
  });

  it("does not send tools key when tools array is empty", async () => {
    vi.mocked(fetch).mockResolvedValue(createSSEResponse(["data: [DONE]\n\n"]));

    const completion = await streamChatCompletion({
      ...defaultOptions,
      tools: [],
    });
    for await (const _ of completion.content) {
      // consume
    }

    const body = JSON.parse(vi.mocked(fetch).mock.calls[0][1]?.body as string);
    expect(body.tools).toBeUndefined();
  });

  it("handles multiple parallel tool calls", async () => {
    const chunk = JSON.stringify({
      id: "chatcmpl-1",
      object: "chat.completion.chunk",
      created: 1,
      model: "test",
      choices: [
        {
          index: 0,
          delta: {
            tool_calls: [
              {
                index: 0,
                id: "call-1",
                function: { name: "ask", arguments: '{"q":"a"}' },
              },
              {
                index: 1,
                id: "call-2",
                function: { name: "ask", arguments: '{"q":"b"}' },
              },
            ],
          },
          finish_reason: null,
        },
      ],
    });

    vi.mocked(fetch).mockResolvedValue(
      createSSEResponse([`data: ${chunk}\n\ndata: [DONE]\n\n`]),
    );

    const completion = await streamChatCompletion(defaultOptions);
    for await (const _ of completion.content) {
      // consume
    }

    const calls = completion.getToolCalls();
    expect(calls).toHaveLength(2);
    expect(calls[0].id).toBe("call-1");
    expect(calls[1].id).toBe("call-2");
  });

  it("returns null usage before stream is consumed", async () => {
    vi.mocked(fetch).mockResolvedValue(
      createSSEResponse([`data: ${makeUsageChunk(10, 5)}\n\ndata: [DONE]\n\n`]),
    );

    const completion = await streamChatCompletion(defaultOptions);
    expect(completion.getUsage()).toBeNull();

    for await (const _ of completion.content) {
      // consume
    }

    expect(completion.getUsage()).toEqual({
      promptTokens: 10,
      completionTokens: 5,
    });
  });
});

describe("resolveApiKey", () => {
  it("returns configApiKey when set", () => {
    expect(resolveApiKey("opencode-zen", "sk-config")).toBe("sk-config");
  });

  it("falls back to OPENCODE_API_KEY env var for opencode-zen type", () => {
    vi.stubEnv("OPENCODE_API_KEY", "sk-env");
    expect(resolveApiKey("opencode-zen")).toBe("sk-env");
    vi.unstubAllEnvs();
  });

  it("falls back to OPENROUTER_API_KEY env var for openrouter type", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-env");
    expect(resolveApiKey("openrouter")).toBe("sk-env");
    vi.unstubAllEnvs();
  });

  it("returns undefined for ollama type with no config key", () => {
    expect(resolveApiKey("ollama")).toBeUndefined();
  });

  it("prefers configApiKey over env var", () => {
    vi.stubEnv("OPENCODE_API_KEY", "sk-env");
    expect(resolveApiKey("opencode-zen", "sk-config")).toBe("sk-config");
    vi.unstubAllEnvs();
  });
});

describe("fetchModels", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends Authorization header when apiKey provided", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: "gpt-4o" }] }), {
        status: 200,
      }),
    );

    await fetchModels("https://api.openai.com", "sk-test");

    const call = vi.mocked(fetch).mock.calls[0];
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-test");
  });

  it("does not send Authorization header when no apiKey", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: "llama3" }] }), {
        status: 200,
      }),
    );

    await fetchModels("http://localhost:11434");

    const call = vi.mocked(fetch).mock.calls[0];
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });

  it("uses /v1/models/user for openrouter with apiKey", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ data: [{ id: "anthropic/claude-sonnet-4" }] }),
        {
          status: 200,
        },
      ),
    );

    await fetchModels("https://openrouter.ai/api", "or-key", "openrouter");

    const call = vi.mocked(fetch).mock.calls[0];
    expect(call[0]).toBe("https://openrouter.ai/api/v1/models/user");
  });

  it("uses /v1/models for openrouter without apiKey", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({ data: [{ id: "anthropic/claude-sonnet-4" }] }),
        {
          status: 200,
        },
      ),
    );

    await fetchModels("https://openrouter.ai/api", undefined, "openrouter");

    const call = vi.mocked(fetch).mock.calls[0];
    expect(call[0]).toBe("https://openrouter.ai/api/v1/models");
  });

  it("uses /v1/models for non-openrouter providers", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: "llama3" }] }), {
        status: 200,
      }),
    );

    await fetchModels("http://localhost:11434", undefined, "ollama");

    const call = vi.mocked(fetch).mock.calls[0];
    expect(call[0]).toBe("http://localhost:11434/v1/models");
  });
});

describe("streamChatCompletion auth", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends Authorization header when apiKey provided", async () => {
    vi.mocked(fetch).mockResolvedValue(createSSEResponse(["data: [DONE]\n\n"]));

    const completion = await streamChatCompletion({
      ...defaultOptions,
      apiKey: "sk-test",
    });
    for await (const _ of completion.content) {
      // consume
    }

    const call = vi.mocked(fetch).mock.calls[0];
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-test");
  });

  it("does not send Authorization header when no apiKey", async () => {
    vi.mocked(fetch).mockResolvedValue(createSSEResponse(["data: [DONE]\n\n"]));

    const completion = await streamChatCompletion(defaultOptions);
    for await (const _ of completion.content) {
      // consume
    }

    const call = vi.mocked(fetch).mock.calls[0];
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
  });
});

describe("fetchContextWindow", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    clearContextWindowCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("extracts context length from Ollama model_info", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          model_info: { "llama.context_length": 8192 },
        }),
        { status: 200 },
      ),
    );

    const result = await fetchContextWindow(
      "http://localhost:11434",
      "llama3",
      "ollama",
    );
    expect(result).toBe(8192);
  });

  it("handles different architecture prefixes", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          model_info: { "qwen2.context_length": 32768 },
        }),
        { status: 200 },
      ),
    );

    const result = await fetchContextWindow(
      "http://localhost:11434",
      "qwen3:8b",
      "ollama",
    );
    expect(result).toBe(32768);
  });

  it("returns default when model_info has no context_length key", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          model_info: { "llama.embedding_length": 4096 },
        }),
        { status: 200 },
      ),
    );

    const result = await fetchContextWindow(
      "http://localhost:11434",
      "unknown",
      "ollama",
    );
    expect(result).toBe(8192);
  });

  it("returns default on HTTP error", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response("Not Found", { status: 404 }),
    );

    const result = await fetchContextWindow(
      "http://localhost:11434",
      "missing",
      "ollama",
    );
    expect(result).toBe(8192);
  });

  it("returns default on network failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("fetch failed"));

    const result = await fetchContextWindow(
      "http://localhost:11434",
      "model",
      "ollama",
    );
    expect(result).toBe(8192);
  });

  it("caches results per baseUrl + model", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          model_info: { "llama.context_length": 16384 },
        }),
        { status: 200 },
      ),
    );

    await fetchContextWindow("http://localhost:11434", "llama3", "ollama");
    await fetchContextWindow("http://localhost:11434", "llama3", "ollama");

    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
  });

  it("sends POST to /api/show with model name", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ model_info: {} }), { status: 200 }),
    );

    await fetchContextWindow("http://localhost:11434", "qwen3:8b", "ollama");

    expect(vi.mocked(fetch)).toHaveBeenCalledWith(
      "http://localhost:11434/api/show",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ model: "qwen3:8b" }),
      }),
    );
  });

  it("extracts context_length from openrouter /v1/models response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [
            { id: "anthropic/claude-sonnet-4", context_length: 200000 },
            { id: "openai/gpt-4o", context_length: 128000 },
          ],
        }),
        { status: 200 },
      ),
    );

    const result = await fetchContextWindow(
      "https://openrouter.ai/api",
      "anthropic/claude-sonnet-4",
      "openrouter",
    );
    expect(result).toBe(200000);
  });

  it("extracts context_length from opencode-zen /v1/models response", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify([
          { id: "opencode/gpt-5.3-codex", context_length: 256000 },
        ]),
        { status: 200 },
      ),
    );

    const result = await fetchContextWindow(
      "https://opencode.ai/zen",
      "opencode/gpt-5.3-codex",
      "opencode-zen",
    );
    expect(result).toBe(256000);
  });

  it("returns default when model not found in models list", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          data: [{ id: "other-model", context_length: 128000 }],
        }),
        { status: 200 },
      ),
    );

    const result = await fetchContextWindow(
      "https://openrouter.ai/api",
      "missing-model",
      "openrouter",
    );
    expect(result).toBe(8192);
  });
});
