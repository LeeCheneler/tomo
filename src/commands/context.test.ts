import { describe, it, expect } from "vitest";
import "./context";
import { getCommand } from "./registry";
import type { CommandCallbacks } from "./types";

function makeCallbacks(
  overrides: Partial<CommandCallbacks> = {},
): CommandCallbacks {
  return {
    onComplete: () => {},
    onCancel: () => {},
    clearMessages: () => {},
    switchSession: () => null,
    setActiveModel: () => {},
    setActiveProvider: () => null,
    reloadProviders: () => {},
    providerBaseUrl: "http://localhost:11434",
    activeModel: "test-model",
    activeProvider: "test",
    providers: [
      { name: "test", baseUrl: "http://localhost:11434", type: "ollama" },
    ],
    contextWindow: 32768,
    maxTokens: 8192,
    tokenUsage: null,
    messageCount: 0,
    ...overrides,
  };
}

describe("/context", () => {
  const cmd = getCommand("context");
  if (!cmd) throw new Error("context command not registered");

  it("shows no-data message when token usage is null", () => {
    const result = cmd.execute("", makeCallbacks());
    expect("output" in result).toBe(true);

    const output = (result as { output: string }).output;
    expect(output).toContain("No token usage data yet");
  });

  it("shows formatted stats when token usage is present", () => {
    const result = cmd.execute(
      "",
      makeCallbacks({
        tokenUsage: { promptTokens: 1500, completionTokens: 500 },
        contextWindow: 32768,
        maxTokens: 8192,
        messageCount: 4,
      }),
    );

    const output = (result as { output: string }).output;
    expect(output).toContain("Context window:");
    expect(output).toContain("32.8k");
    expect(output).toContain("Prompt tokens:");
    expect(output).toContain("1.5k");
    expect(output).toContain("Response tokens:");
    expect(output).toContain("500");
    expect(output).toContain("Total used:");
    expect(output).toContain("2.0k");
    expect(output).toContain("6%");
    expect(output).toContain("Input budget:");
    expect(output).toContain("24.6k");
    expect(output).toContain("Messages:");
    expect(output).toContain("4");
  });

  it("formats small token counts without k suffix", () => {
    const result = cmd.execute(
      "",
      makeCallbacks({
        tokenUsage: { promptTokens: 50, completionTokens: 20 },
        contextWindow: 4096,
        maxTokens: 512,
        messageCount: 2,
      }),
    );

    const output = (result as { output: string }).output;
    expect(output).toContain("4.1k");
    expect(output).toContain("50");
    expect(output).toContain("20");
    expect(output).toContain("70");
    expect(output).toContain("2%");
  });
});
