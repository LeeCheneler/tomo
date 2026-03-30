import chalk from "chalk";
import { Box, Text } from "ink";
import { useEffect, useState } from "react";

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const VERBS = [
  "Thinking",
  "Reasoning",
  "Pondering",
  "Analyzing",
  "Considering",
  "Processing",
  "Reflecting",
  "Contemplating",
  "Evaluating",
  "Deliberating",
];

const SHIMMER_WIDTH = 3;
const TICK_MS = 80;

/** Animated spinner with cycling verbs and a shimmer effect across the text. */
export function ThinkingIndicator() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const spinnerFrame = SPINNER_FRAMES[tick % SPINNER_FRAMES.length] as string;

  const firstVerbLength = (VERBS[0] as string).length;
  const verbIndex =
    Math.floor(tick / (SHIMMER_WIDTH + firstVerbLength + 4)) % VERBS.length;
  const verb = VERBS[verbIndex] as string;

  const shimmerPos = (tick % (verb.length + SHIMMER_WIDTH + 4)) - SHIMMER_WIDTH;

  const styledChars = [...verb].map((char, i) => {
    const dist = i - shimmerPos;
    if (dist >= 0 && dist < SHIMMER_WIDTH) {
      const brightness = 1 - dist / SHIMMER_WIDTH;
      const grey = Math.round(100 + brightness * 155);
      return chalk.rgb(grey, grey, grey)(char);
    }
    return chalk.gray(char);
  });

  return (
    <Box>
      <Text color="cyan">{spinnerFrame} </Text>
      <Text>{styledChars.join("")}</Text>
      <Text dimColor>{"  esc cancel"}</Text>
    </Box>
  );
}
