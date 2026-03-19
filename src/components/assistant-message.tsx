import { Box, Text } from "ink";
import { Markdown } from "./markdown";

interface AssistantMessageProps {
  children: string;
  thinking?: string;
}

export function AssistantMessage({
  children,
  thinking,
}: AssistantMessageProps) {
  return (
    <Box flexDirection="column">
      {thinking ? (
        <Box marginLeft={2}>
          <Text dimColor italic>
            {thinking}
          </Text>
        </Box>
      ) : null}
      {children ? <Markdown>{children}</Markdown> : null}
    </Box>
  );
}
