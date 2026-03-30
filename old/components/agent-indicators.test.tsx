import { render } from "ink-testing-library";
import { afterEach, describe, expect, it } from "vitest";
import {
  addAgent,
  incrementToolCalls,
  removeAgent,
} from "../tools/agent-tracker";
import { AgentIndicators } from "./agent-indicators";

const flush = () => new Promise((r) => setTimeout(r, 100));

const trackedIds: string[] = [];
afterEach(() => {
  for (const id of trackedIds) {
    removeAgent(id);
  }
  trackedIds.length = 0;
});

function add(id: string, prompt: string) {
  trackedIds.push(id);
  addAgent(id, prompt);
}

describe("AgentIndicators", () => {
  it("renders nothing when no agents are active", () => {
    const { lastFrame } = render(<AgentIndicators />);
    expect(lastFrame()).toBe("");
  });

  it("renders an indicator for an active agent", async () => {
    const { lastFrame } = render(<AgentIndicators />);

    add("a1", "explore auth patterns");
    await flush();

    const output = lastFrame() ?? "";
    expect(output).toContain("Agent:");
    expect(output).toContain("explore auth patterns");
  });

  it("renders multiple agents simultaneously", async () => {
    const { lastFrame } = render(<AgentIndicators />);

    add("a1", "check dependencies");
    add("a2", "review docs");
    await flush();

    const output = lastFrame() ?? "";
    expect(output).toContain("check dependencies");
    expect(output).toContain("review docs");
  });

  it("shows tool call count", async () => {
    const { lastFrame } = render(<AgentIndicators />);

    add("a1", "explore code");
    incrementToolCalls("a1");
    incrementToolCalls("a1");
    incrementToolCalls("a1");
    await flush();

    const output = lastFrame() ?? "";
    expect(output).toContain("3 tool calls");
  });

  it("uses singular for 1 tool call", async () => {
    const { lastFrame } = render(<AgentIndicators />);

    add("a1", "quick lookup");
    incrementToolCalls("a1");
    await flush();

    const output = lastFrame() ?? "";
    expect(output).toContain("1 tool call)");
    expect(output).not.toContain("1 tool calls");
  });

  it("removes indicator when agent completes", async () => {
    const { lastFrame } = render(<AgentIndicators />);

    add("a1", "temporary task");
    await flush();
    expect(lastFrame()).toContain("temporary task");

    removeAgent("a1");
    trackedIds.pop();
    await flush();

    expect(lastFrame()).toBe("");
  });

  it("truncates long prompts", async () => {
    const { lastFrame } = render(<AgentIndicators />);

    const longPrompt =
      "investigate all authentication patterns across the entire codebase including middleware";
    add("a1", longPrompt);
    await flush();

    const output = lastFrame() ?? "";
    expect(output).toContain("…");
    expect(output).not.toContain("middleware");
  });
});
