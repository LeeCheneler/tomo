import chalk from "chalk";
import { Box, Text } from "ink";
import { useEffect, useState } from "react";
import { theme } from "./theme";

/** Braille dot spinner frames. */
const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

/** Width of the bright shimmer band in characters. */
const SHIMMER_WIDTH = 3;

/** Milliseconds between animation ticks. */
const TICK_MS = 80;

/** Props for LoadingIndicator. */
export interface LoadingIndicatorProps {
  /** Text to display with the shimmer animation. */
  text: string;
  /** Color for the spinner. Defaults to theme.brand. */
  color?: string;
}

/** Applies a shimmer effect to text, creating a bright wave that sweeps across dim characters. */
function shimmerText(text: string, tick: number): string {
  const shimmerPos = (tick % (text.length + SHIMMER_WIDTH + 4)) - SHIMMER_WIDTH;

  return [...text]
    .map((char, i) => {
      const dist = i - shimmerPos;
      if (dist >= 0 && dist < SHIMMER_WIDTH) {
        const brightness = 1 - dist / SHIMMER_WIDTH;
        const grey = Math.round(100 + brightness * 155);
        return chalk.rgb(grey, grey, grey)(char);
      }
      return chalk.gray(char);
    })
    .join("");
}

/** Animated spinner with a shimmer effect sweeping across the text. */
export function LoadingIndicator(props: LoadingIndicatorProps) {
  const color = props.color ?? theme.brand;
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const spinnerFrame = SPINNER_FRAMES[tick % SPINNER_FRAMES.length];

  return (
    <Box>
      <Text color={color}>{spinnerFrame} </Text>
      <Text>{shimmerText(props.text, tick)}</Text>
    </Box>
  );
}
