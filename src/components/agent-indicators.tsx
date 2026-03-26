import { Box, Text } from "ink";
import { useEffect, useState } from "react";
import { useActiveAgents } from "../tools/agent-tracker";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const COLORS = ["cyan", "magenta", "yellow", "green"] as const;
const TICK_MS = 80;
const MAX_PROMPT_LENGTH = 50;

function truncatePrompt(prompt: string): string {
  const oneLine = prompt.replace(/\n/g, " ").trim();
  if (oneLine.length <= MAX_PROMPT_LENGTH) return oneLine;
  return `${oneLine.slice(0, MAX_PROMPT_LENGTH)}…`;
}

/** Renders progress indicators for all active sub-agents. */
export function AgentIndicators() {
  const agents = useActiveAgents();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (agents.length === 0) return;
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, [agents.length]);

  if (agents.length === 0) return null;

  const frame = SPINNER_FRAMES[tick % SPINNER_FRAMES.length];

  return (
    <Box flexDirection="column">
      {agents.map((agent, i) => {
        const color = COLORS[i % COLORS.length];
        const progress =
          agent.toolCallCount > 0
            ? ` (${agent.toolCallCount} tool call${agent.toolCallCount === 1 ? "" : "s"})`
            : "";
        return (
          <Text key={agent.id}>
            <Text color={color}>{frame} </Text>
            <Text color={color}>Agent: </Text>
            <Text dimColor>
              {'"'}
              {truncatePrompt(agent.prompt)}
              {'"'}
              {progress}
            </Text>
          </Text>
        );
      })}
    </Box>
  );
}
