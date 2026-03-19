import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { streamChatCompletion, type ChatMessage } from "./client";

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

    const tokens: string[] = [];
    for await (const token of streamChatCompletion(defaultOptions)) {
      tokens.push(token);
    }

    expect(tokens).toEqual(["Hello", " world"]);
  });

  it("sends correct request to the endpoint", async () => {
    vi.mocked(fetch).mockResolvedValue(createSSEResponse(["data: [DONE]\n\n"]));

    const messages: ChatMessage[] = [
      { role: "system", content: "You are helpful" },
      { role: "user", content: "Hi" },
    ];

    for await (const _ of streamChatCompletion({
      baseUrl: "http://localhost:11434",
      model: "llama3",
      messages,
    })) {
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
        }),
      }),
    );
  });

  it("strips trailing slashes from baseUrl", async () => {
    vi.mocked(fetch).mockResolvedValue(createSSEResponse(["data: [DONE]\n\n"]));

    for await (const _ of streamChatCompletion({
      ...defaultOptions,
      baseUrl: "http://localhost:11434/",
    })) {
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

    await expect(async () => {
      for await (const _ of streamChatCompletion(defaultOptions)) {
        // consume
      }
    }).rejects.toThrow("Provider returned HTTP 500: Internal Server Error");
  });

  it("throws on connection failure", async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError("fetch failed"));

    await expect(async () => {
      for await (const _ of streamChatCompletion(defaultOptions)) {
        // consume
      }
    }).rejects.toThrow("Failed to connect to provider");
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

    const tokens: string[] = [];
    for await (const token of streamChatCompletion(defaultOptions)) {
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

    await expect(async () => {
      for await (const _ of streamChatCompletion({
        ...defaultOptions,
        signal: controller.signal,
      })) {
        // consume
      }
    }).rejects.toThrow("aborted");
  });

  it("throws on empty response body", async () => {
    const response = new Response(null, { status: 200 });
    Object.defineProperty(response, "body", { value: null });
    vi.mocked(fetch).mockResolvedValue(response);

    await expect(async () => {
      for await (const _ of streamChatCompletion(defaultOptions)) {
        // consume
      }
    }).rejects.toThrow("Provider returned an empty response body");
  });
});
