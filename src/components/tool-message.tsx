import { Box, Text } from "ink";

const VISIBLE_LINES = 5;

interface ToolMessageProps {
  children: string;
}

/** Renders tool output. Truncates to last 5 body lines with hidden line count. */
export function ToolMessage({ children }: ToolMessageProps) {
  const lines = children.split("\n");
  const header = lines[0] ?? "";
  const bodyLines = lines.slice(1);
  const bodyTotal = bodyLines.length;
  const needsTruncate = bodyTotal > VISIBLE_LINES;

  const displayBody = needsTruncate
    ? bodyLines.slice(-VISIBLE_LINES).join("\n")
    : bodyLines.join("\n");

  const hiddenCount = bodyTotal - VISIBLE_LINES;

  return (
    <Box flexDirection="column">
      <Text>{header}</Text>
      {needsTruncate ? (
        <Text dimColor>
          {"  ▸ "}
          {hiddenCount} more lines
        </Text>
      ) : null}
      {displayBody ? <Text dimColor>{displayBody}</Text> : null}
    </Box>
  );
}
