import { Text } from "ink";
import type { ReactNode } from "react";

/** Props for the Hint component. */
interface HintProps {
  children: ReactNode;
}

/** Renders dim text for instructions, secondary info, and keyboard shortcuts. */
export function Hint(props: HintProps) {
  return <Text dimColor>{props.children}</Text>;
}
