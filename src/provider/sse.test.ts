import { describe, it, expect } from "vitest";
import { parseSSEStream } from "./sse";

/** Creates a ReadableStream from an array of string chunks. */
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

/** Collects all values from an async generator into an array. */
async function collect(gen: AsyncGenerator<string>): Promise<string[]> {
  const results: string[] = [];
  for await (const value of gen) {
    results.push(value);
  }
  return results;
}

describe("parseSSEStream", () => {
  it("yields data from a single chunk", async () => {
    const stream = createStream(['data: {"a":1}\n\n']);
    const results = await collect(parseSSEStream(stream));
    expect(results).toEqual(['{"a":1}']);
  });

  it("yields multiple events from a single chunk", async () => {
    const stream = createStream(['data: {"a":1}\n\ndata: {"b":2}\n\n']);
    const results = await collect(parseSSEStream(stream));
    expect(results).toEqual(['{"a":1}', '{"b":2}']);
  });

  it("yields data split across multiple chunks", async () => {
    const stream = createStream(['data: {"a":', "1}\n\n"]);
    const results = await collect(parseSSEStream(stream));
    expect(results).toEqual(['{"a":1}']);
  });

  it("stops at [DONE]", async () => {
    const stream = createStream([
      'data: {"a":1}\n\ndata: [DONE]\n\ndata: {"b":2}\n\n',
    ]);
    const results = await collect(parseSSEStream(stream));
    expect(results).toEqual(['{"a":1}']);
  });

  it("handles empty stream", async () => {
    const stream = createStream([]);
    const results = await collect(parseSSEStream(stream));
    expect(results).toEqual([]);
  });

  it("ignores non-data lines", async () => {
    const stream = createStream(['event: message\ndata: {"a":1}\nid: 123\n\n']);
    const results = await collect(parseSSEStream(stream));
    expect(results).toEqual(['{"a":1}']);
  });

  it("handles events split on newline boundaries", async () => {
    const stream = createStream(['data: {"a":1}\n', "\n", 'data: {"b":2}\n\n']);
    const results = await collect(parseSSEStream(stream));
    expect(results).toEqual(['{"a":1}', '{"b":2}']);
  });

  it("handles trailing data without double newline", async () => {
    const stream = createStream(['data: {"a":1}\n\ndata: {"b":2}']);
    const results = await collect(parseSSEStream(stream));
    // Only first event is complete; second lacks the terminating \n\n
    expect(results).toEqual(['{"a":1}']);
  });
});
