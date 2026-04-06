import { Box, Text } from "ink";
import { theme } from "./theme";

/** Returns the theme color for a diff line based on its prefix. */
function diffLineColor(line: string): string | undefined {
  if (line.startsWith("+")) return theme.success;
  if (line.startsWith("-")) return theme.error;
  if (line.startsWith("@@")) return "cyan";
  return undefined;
}

/** Renders diff output with colored lines (+green, -red, @@cyan). */
export function DiffView(props: { output: string }) {
  const lines = props.output.split("\n");
  return (
    <Box flexDirection="column">
      {/* Diff lines are static output that never reorders — index keys are safe. */}
      {lines.map((line, i) => {
        const color = diffLineColor(line);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: static diff output
          <Text key={i} dimColor={!color} color={color}>
            {line}
          </Text>
        );
      })}
    </Box>
  );
}
