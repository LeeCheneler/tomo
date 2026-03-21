import { Box, Text } from "ink";

const COLLAPSED_LINES = 5;

interface ToolMessageProps {
  children: string;
  expanded: boolean;
}

/** Renders tool output with collapsed/expanded display. */
export function ToolMessage({ children, expanded }: ToolMessageProps) {
  const lines = children.split("\n");
  // First line is the tool header (styled with chalk), rest is body
  const header = lines[0] ?? "";
  const bodyLines = lines.slice(1);
  const bodyTotal = bodyLines.length;
  const needsCollapse = bodyTotal > COLLAPSED_LINES;

  const displayBody =
    !expanded && needsCollapse
      ? bodyLines.slice(-COLLAPSED_LINES).join("\n")
      : bodyLines.join("\n");

  const hiddenCount = bodyTotal - COLLAPSED_LINES;

  return (
    <Box flexDirection="column">
      <Text>{header}</Text>
      {!expanded && needsCollapse ? (
        <Text dimColor>
          {"  ▸ "}
          {hiddenCount} more lines (Tab to expand)
        </Text>
      ) : null}
      {expanded && needsCollapse ? (
        <Text dimColor>{"  ▾ Tab to collapse"}</Text>
      ) : null}
      {displayBody ? <Text dimColor>{displayBody}</Text> : null}
    </Box>
  );
}
