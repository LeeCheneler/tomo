import { describe, expect, it } from "vitest";
import { parseSSEStream } from "./sse";

function createStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

async function collect(gen: AsyncGenerator<string>): Promise<string[]> {
  const results: string[] = [];
  for await (const item of gen) {
    results.push(item);
  }
  return results;
}

describe("parseSSEStream", () => {
  it("parses complete data lines", async () => {
    const stream = createStream([
      'data: {"content":"hello"}\n\ndata: {"content":"world"}\n\n',
    ]);
    const results = await collect(parseSSEStream(stream));
    expect(results).toEqual(['{"content":"hello"}', '{"content":"world"}']);
  });

  it("handles data split across chunks", async () => {
    const stream = createStream(['data: {"con', 'tent":"hello"}\n\n']);
    const results = await collect(parseSSEStream(stream));
    expect(results).toEqual(['{"content":"hello"}']);
  });

  it("stops at [DONE]", async () => {
    const stream = createStream([
      'data: {"content":"hello"}\n\ndata: [DONE]\n\ndata: {"content":"ignored"}\n\n',
    ]);
    const results = await collect(parseSSEStream(stream));
    expect(results).toEqual(['{"content":"hello"}']);
  });

  it("ignores non-data lines", async () => {
    const stream = createStream([
      ': comment\nevent: something\ndata: {"content":"hello"}\n\n',
    ]);
    const results = await collect(parseSSEStream(stream));
    expect(results).toEqual(['{"content":"hello"}']);
  });

  it("handles empty stream", async () => {
    const stream = createStream([]);
    const results = await collect(parseSSEStream(stream));
    expect(results).toEqual([]);
  });

  it("handles multiple data lines in sequence", async () => {
    const stream = createStream([
      'data: {"a":1}\ndata: {"b":2}\n',
      'data: {"c":3}\n',
    ]);
    const results = await collect(parseSSEStream(stream));
    expect(results).toEqual(['{"a":1}', '{"b":2}', '{"c":3}']);
  });

  it("handles \\r\\n line endings", async () => {
    const stream = createStream([
      'data: {"content":"hello"}\r\n\r\ndata: {"content":"world"}\r\n\r\n',
    ]);
    const results = await collect(parseSSEStream(stream));
    expect(results).toEqual(['{"content":"hello"}', '{"content":"world"}']);
  });

  it("handles remaining buffer without trailing newline", async () => {
    const stream = createStream(['data: {"content":"last"}']);
    const results = await collect(parseSSEStream(stream));
    expect(results).toEqual(['{"content":"last"}']);
  });
});
