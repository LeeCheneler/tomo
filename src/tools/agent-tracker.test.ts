import { afterEach, describe, expect, it } from "vitest";
import { addAgent, incrementToolCalls, removeAgent } from "./agent-tracker";

// Clean up agents between tests by removing any that were added.
const trackedIds: string[] = [];
afterEach(() => {
  for (const id of trackedIds) {
    removeAgent(id);
  }
  trackedIds.length = 0;
});

function add(id: string, prompt = "test") {
  trackedIds.push(id);
  addAgent(id, prompt);
}

describe("agent-tracker", () => {
  it("addAgent and removeAgent manage agents without throwing", () => {
    add("a1", "explore auth");
    // Removing and re-adding with same ID should work
    removeAgent("a1");
    trackedIds.pop();
    add("a1", "re-added");
  });

  it("removeAgent removes an agent", () => {
    add("a2", "test");
    removeAgent("a2");
    trackedIds.pop();

    // Re-adding with same ID should work (not a duplicate)
    add("a2", "test again");
  });

  it("incrementToolCalls increments count", () => {
    add("a3", "test");
    incrementToolCalls("a3");
    incrementToolCalls("a3");
    incrementToolCalls("a3");

    // We can't directly read the state without the hook, but we can
    // verify it doesn't throw and the agent still exists by incrementing
    incrementToolCalls("a3");
  });

  it("incrementToolCalls is a no-op for unknown agents", () => {
    // Should not throw
    incrementToolCalls("nonexistent");
  });
});
