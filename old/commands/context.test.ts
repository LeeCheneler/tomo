import { describe, expect, it } from "vitest";
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
    mcpFailedServers: [],
    ...overrides,
  };
}

describe("/context", () => {
  const cmd = getCommand("context");
  if (!cmd) throw new Error("context command not registered");

  it("shows 0% usage when no token data yet", () => {
    const result = cmd.execute("", makeCallbacks());
    const output = (result as { output: string; status: string }).output;

    expect(output).toContain("0% used");
    expect(output).toContain("░".repeat(30));
    expect(output).toContain("0 / 32.8k tokens");
    expect(output).toContain("Context window     32.8k tokens");
    expect(output).toContain("Response reserve   8.2k tokens");
    expect(output).toContain("Input budget       24.6k tokens");
  });

  it("shows progress bar and config with token usage", () => {
    const result = cmd.execute(
      "",
      makeCallbacks({
        tokenUsage: { promptTokens: 1500, completionTokens: 500 },
        contextWindow: 32768,
        maxTokens: 8192,
      }),
    );

    const output = (result as { output: string; status: string }).output;
    expect(output).toContain("6% used");
    expect(output).toContain("2.0k / 32.8k tokens");
    expect(output).toContain("Context window     32.8k tokens");
    expect(output).toContain("Response reserve   8.2k tokens");
    expect(output).toContain("Input budget       24.6k tokens");
    expect(output).toContain(
      "input budget = context window - response reserve",
    );
  });

  it("shows filled progress bar at high usage", () => {
    const result = cmd.execute(
      "",
      makeCallbacks({
        tokenUsage: { promptTokens: 30000, completionTokens: 1000 },
        contextWindow: 32768,
        maxTokens: 8192,
      }),
    );

    const output = (result as { output: string; status: string }).output;
    expect(output).toContain("95% used");
    const bar = output.split("\n")[0] ?? "";
    const filledCount = (bar.match(/█/g) || []).length;
    expect(filledCount).toBeGreaterThanOrEqual(28);
  });

  it("formats small token counts without k suffix", () => {
    const result = cmd.execute(
      "",
      makeCallbacks({
        tokenUsage: { promptTokens: 50, completionTokens: 20 },
        contextWindow: 4096,
        maxTokens: 512,
      }),
    );

    const output = (result as { output: string; status: string }).output;
    expect(output).toContain("2% used");
    expect(output).toContain("70 / 4.1k tokens");
    expect(output).toContain("Input budget       3.6k tokens");
  });
});
