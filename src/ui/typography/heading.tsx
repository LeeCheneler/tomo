import { Text } from "ink";
import type { ReactNode } from "react";

/** Props for the Heading component. */
interface HeadingProps {
  children: ReactNode;
}

/** Renders bold text for section titles and menu headers. */
export function Heading(props: HeadingProps) {
  return (
    <Text bold underline>
      {props.children}
    </Text>
  );
}
