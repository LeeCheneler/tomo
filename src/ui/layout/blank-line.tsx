import { Text } from "ink";

/** Props for the BlankLine component. */
interface BlankLineProps {
  lines?: number;
}

/** Renders vertical blank lines for spacing between sections. */
export function BlankLine(props: BlankLineProps) {
  const count = props.lines ?? 1;
  return <Text>{"\n".repeat(count)}</Text>;
}
