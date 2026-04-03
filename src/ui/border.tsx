import { Text } from "ink";

/** Returns the terminal width, defaulting to 80 if unavailable. */
function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}

/** Props for Border. */
interface BorderProps {
  color?: string;
}

/** Renders a full-width horizontal border line. */
export function Border(props: BorderProps) {
  return <Text color={props.color}>{"─".repeat(getTerminalWidth())}</Text>;
}
