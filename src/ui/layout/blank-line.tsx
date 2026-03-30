import { Box, Text } from "ink";

/** Props for the BlankLine component. */
interface BlankLineProps {
  lines?: number;
}

/** Renders vertical blank lines for spacing between sections. */
export function BlankLine(props: BlankLineProps) {
  const count = props.lines ?? 1;
  const items = Array.from({ length: count }, (_, i) => i);
  return (
    <Box flexDirection="column">
      {items.map((i) => (
        <Text key={i}> </Text>
      ))}
    </Box>
  );
}
