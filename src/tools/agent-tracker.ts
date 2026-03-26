import { useState, useEffect } from "react";

export interface ActiveAgent {
  id: string;
  prompt: string;
  toolCallCount: number;
}

type Listener = () => void;

const activeAgents = new Map<string, ActiveAgent>();
const listeners = new Set<Listener>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

/** Register a new active agent. */
export function addAgent(id: string, prompt: string): void {
  activeAgents.set(id, { id, prompt, toolCallCount: 0 });
  notify();
}

/** Remove a completed agent. */
export function removeAgent(id: string): void {
  activeAgents.delete(id);
  notify();
}

/** Increment the tool call count for an agent. */
export function incrementToolCalls(id: string): void {
  const agent = activeAgents.get(id);
  if (agent) {
    agent.toolCallCount++;
    notify();
  }
}

/** React hook that subscribes to active agent state changes. */
export function useActiveAgents(): ActiveAgent[] {
  const [snapshot, setSnapshot] = useState<ActiveAgent[]>([
    ...activeAgents.values(),
  ]);

  useEffect(() => {
    const listener = () => setSnapshot([...activeAgents.values()]);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return snapshot;
}
