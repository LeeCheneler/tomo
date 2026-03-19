import { describe, it, expect } from "vitest";
import { extractThinking, type ThinkingChunk } from "./thinking";

async function* tokensFrom(strings: string[]): AsyncGenerator<string> {
  for (const s of strings) {
    yield s;
  }
}

async function collect(
  gen: AsyncGenerator<ThinkingChunk>,
): Promise<ThinkingChunk[]> {
  const results: ThinkingChunk[] = [];
  for await (const chunk of gen) {
    results.push(chunk);
  }
  return results;
}

describe("extractThinking", () => {
  it("passes through content with no thinking tags", async () => {
    const result = await collect(
      extractThinking(tokensFrom(["Hello ", "world"])),
    );
    expect(result).toEqual([
      { type: "content", text: "Hello " },
      { type: "content", text: "world" },
    ]);
  });

  it("extracts thinking block in a single token", async () => {
    const result = await collect(
      extractThinking(
        tokensFrom(["<think>reasoning here</think>The answer is 42"]),
      ),
    );
    expect(result).toEqual([
      { type: "thinking", text: "reasoning here" },
      { type: "content", text: "The answer is 42" },
    ]);
  });

  it("handles thinking tags split across tokens", async () => {
    const result = await collect(
      extractThinking(
        tokensFrom(["<thi", "nk>", "I think", "</thi", "nk>", "Answer"]),
      ),
    );
    expect(result).toEqual([
      { type: "thinking", text: "I think" },
      { type: "content", text: "Answer" },
    ]);
  });

  it("handles partial open tag at chunk boundary", async () => {
    const result = await collect(
      extractThinking(tokensFrom(["Hello <", "think>thinking</think>done"])),
    );
    expect(result).toEqual([
      { type: "content", text: "Hello " },
      { type: "thinking", text: "thinking" },
      { type: "content", text: "done" },
    ]);
  });

  it("handles partial close tag at chunk boundary", async () => {
    const result = await collect(
      extractThinking(tokensFrom(["<think>thoughts</", "think>content"])),
    );
    expect(result).toEqual([
      { type: "thinking", text: "thoughts" },
      { type: "content", text: "content" },
    ]);
  });

  it("handles thinking at the very start of response", async () => {
    const result = await collect(
      extractThinking(
        tokensFrom([
          "<think>",
          "Let me reason",
          "</think>",
          "\n\nHere's the answer",
        ]),
      ),
    );
    expect(result).toEqual([
      { type: "thinking", text: "Let me reason" },
      { type: "content", text: "\n\nHere's the answer" },
    ]);
  });

  it("handles multiple thinking blocks", async () => {
    const result = await collect(
      extractThinking(
        tokensFrom([
          "<think>first thought</think>response one<think>second thought</think>response two",
        ]),
      ),
    );
    expect(result).toEqual([
      { type: "thinking", text: "first thought" },
      { type: "content", text: "response one" },
      { type: "thinking", text: "second thought" },
      { type: "content", text: "response two" },
    ]);
  });

  it("handles empty thinking block", async () => {
    const result = await collect(
      extractThinking(tokensFrom(["<think></think>content"])),
    );
    expect(result).toEqual([{ type: "content", text: "content" }]);
  });

  it("handles < characters that are not tags", async () => {
    const result = await collect(
      extractThinking(tokensFrom(["x < y and a <b> tag"])),
    );
    expect(result).toEqual([{ type: "content", text: "x < y and a <b> tag" }]);
  });

  it("flushes unterminated thinking block as thinking", async () => {
    const result = await collect(
      extractThinking(tokensFrom(["<think>still thinking..."])),
    );
    expect(result).toEqual([{ type: "thinking", text: "still thinking..." }]);
  });

  it("handles empty token stream", async () => {
    const result = await collect(extractThinking(tokensFrom([])));
    expect(result).toEqual([]);
  });

  it("handles single-character tokens through a tag", async () => {
    const result = await collect(
      extractThinking(
        tokensFrom([
          "<",
          "t",
          "h",
          "i",
          "n",
          "k",
          ">",
          "ok",
          "<",
          "/",
          "t",
          "h",
          "i",
          "n",
          "k",
          ">",
          "done",
        ]),
      ),
    );
    expect(result).toEqual([
      { type: "thinking", text: "ok" },
      { type: "content", text: "done" },
    ]);
  });
});
