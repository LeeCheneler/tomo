import { Box } from "ink";
import type { ReactNode } from "react";

/** Characters per indent level. */
const INDENT_SIZE = 2;

/** Props for the Indent component. */
interface IndentProps {
  level?: number;
  children: ReactNode;
}

/** Wraps children with consistent left padding based on indent level. */
export function Indent(props: IndentProps) {
  return (
    <Box paddingLeft={(props.level ?? 1) * INDENT_SIZE}>{props.children}</Box>
  );
}
