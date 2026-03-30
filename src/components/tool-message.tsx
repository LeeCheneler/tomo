import { Text } from "ink";

interface ToolMessageProps {
  children: string;
}

/** Renders tool output as a single header line. Full output available via Tab. */
export function ToolMessage({ children }: ToolMessageProps) {
  const header = children.split("\n")[0] ?? "";

  return <Text>{header}</Text>;
}
