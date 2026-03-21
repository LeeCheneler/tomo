import { Box, Text } from "ink";

const COLLAPSED_LINES = 5;

interface ToolMessageProps {
  children: string;
  expanded: boolean;
}

/** Renders tool output with collapsed/expanded display. */
export function ToolMessage({ children, expanded }: ToolMessageProps) {
  const lines = children.split("\n");
  const totalLines = lines.length;
  const needsCollapse = totalLines > COLLAPSED_LINES;

  const displayContent =
    !expanded && needsCollapse
      ? lines.slice(-COLLAPSED_LINES).join("\n")
      : children;

  const hiddenCount = totalLines - COLLAPSED_LINES;

  return (
    <Box flexDirection="column">
      {!expanded && needsCollapse ? (
        <Text dimColor>
          {"  ▸ "}
          {hiddenCount} more lines (Tab to expand)
        </Text>
      ) : null}
      {expanded && needsCollapse ? (
        <Text dimColor>{"  ▾ Tab to collapse"}</Text>
      ) : null}
      <Text dimColor>{displayContent}</Text>
    </Box>
  );
}
