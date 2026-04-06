import { describe, expect, it } from "vitest";
import { createElement, useRef } from "react";
import type { Provider } from "../config/schema";
import { renderInk } from "../test-utils/ink";
import { setupMsw, http, HttpResponse } from "../test-utils/msw";
import type { UseCompletionResult } from "./use-completion";
import { useCompletion } from "./use-completion";

/** Builds an SSE response body from data objects. */
function sseBody(chunks: unknown[]): string {
  return (
    chunks.map((c) => `data: ${JSON.stringify(c)}`).join("\n\n") +
    "\n\ndata: [DONE]\n\n"
  );
}

/** Standard test provider. */
const PROVIDER: Provider = {
  name: "test",
  type: "ollama",
  baseUrl: "http://localhost:11434",
};

const MODEL = "llama3";

/**
 * Test harness that exposes the hook result via a ref.
 * Renders nothing — just captures the hook's return value for assertions.
 */
function createHarness(provider: Provider | null, model: string | null) {
  const ref: { current: UseCompletionResult | null } = { current: null };

  /** Captures hook result into the shared ref. */
  function Harness() {
    const result = useCompletion(provider, model);
    const refObj = useRef(ref);
    refObj.current.current = result;
    // Also update the outer ref directly for synchronous access
    ref.current = result;
    return null;
  }

  return { Harness, ref };
}

describe("useCompletion", () => {
  const server = setupMsw();

  it("starts in idle state", () => {
    const { Harness, ref } = createHarness(PROVIDER, MODEL);
    renderInk(createElement(Harness));

    expect(ref.current?.state).toBe("idle");
    expect(ref.current?.content).toBe("");
    expect(ref.current?.error).toBeNull();
    expect(ref.current?.usage).toBeNull();
  });

  it("stays idle when provider is null", () => {
    const { Harness, ref } = createHarness(null, MODEL);
    renderInk(createElement(Harness));

    ref.current?.send({ messages: [{ role: "user", content: "hello" }] });
    expect(ref.current?.state).toBe("idle");
  });

  it("stays idle when model is null", () => {
    const { Harness, ref } = createHarness(PROVIDER, null);
    renderInk(createElement(Harness));

    ref.current?.send({ messages: [{ role: "user", content: "hello" }] });
    expect(ref.current?.state).toBe("idle");
  });

  it("streams content and reaches complete state", async () => {
    server.use(
      http.post(
        "http://localhost:11434/v1/chat/completions",
        () =>
          new HttpResponse(
            sseBody([
              { choices: [{ delta: { content: "Hello" } }] },
              { choices: [{ delta: { content: " world" } }] },
              { usage: { prompt_tokens: 5, completion_tokens: 2 } },
            ]),
            { headers: { "Content-Type": "text/event-stream" } },
          ),
      ),
    );

    const { Harness, ref } = createHarness(PROVIDER, MODEL);
    renderInk(createElement(Harness));

    ref.current?.send({ messages: [{ role: "user", content: "hello" }] });
    await new Promise((r) => setTimeout(r, 50));

    expect(ref.current?.state).toBe("complete");
    expect(ref.current?.content).toBe("Hello world");
    expect(ref.current?.usage).toEqual({
      promptTokens: 5,
      completionTokens: 2,
    });
    expect(ref.current?.error).toBeNull();
  });

  it("sets error state on fetch failure", async () => {
    server.use(
      http.post(
        "http://localhost:11434/v1/chat/completions",
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    const { Harness, ref } = createHarness(PROVIDER, MODEL);
    renderInk(createElement(Harness));

    ref.current?.send({ messages: [{ role: "user", content: "hello" }] });
    await new Promise((r) => setTimeout(r, 50));

    expect(ref.current?.state).toBe("error");
    expect(ref.current?.error).toContain("500");
  });

  it("abort is safe to call when idle", async () => {
    const { Harness, ref } = createHarness(PROVIDER, MODEL);
    renderInk(createElement(Harness));

    ref.current?.abort();
    await new Promise((r) => setTimeout(r, 50));

    expect(ref.current?.state).toBe("aborted");
  });

  it("keeps partial content on abort", async () => {
    const cleanup: { resolve: (() => void) | null } = { resolve: null };

    server.use(
      http.post("http://localhost:11434/v1/chat/completions", () => {
        const body = new ReadableStream({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(
              encoder.encode(
                'data: {"choices":[{"delta":{"content":"partial"}}]}\n\n',
              ),
            );
            // Hold the stream open until cleanup.resolve is called
            cleanup.resolve = () => {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              controller.close();
            };
          },
        });
        return new HttpResponse(body, {
          headers: { "Content-Type": "text/event-stream" },
        });
      }),
    );

    const { Harness, ref } = createHarness(PROVIDER, MODEL);
    renderInk(createElement(Harness));

    ref.current?.send({ messages: [{ role: "user", content: "hello" }] });
    await new Promise((r) => setTimeout(r, 50));

    expect(ref.current?.content).toBe("partial");

    ref.current?.abort();
    await new Promise((r) => setTimeout(r, 50));

    expect(ref.current?.state).toBe("aborted");
    expect(ref.current?.content).toBe("partial");

    // Clean up the hanging stream
    cleanup.resolve?.();
  });
});
