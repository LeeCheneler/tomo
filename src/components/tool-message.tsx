import { Box, Text } from "ink";

interface ToolMessageProps {
  children: string;
}

/** Renders tool output. First line is the header, rest is dim body. */
export function ToolMessage({ children }: ToolMessageProps) {
  const lines = children.split("\n");
  const header = lines[0] ?? "";
  const body = lines.slice(1).join("\n");

  return (
    <Box flexDirection="column">
      <Text>{header}</Text>
      {body ? <Text dimColor>{body}</Text> : null}
    </Box>
  );
}
