import { Text } from "ink";

interface SystemMessageProps {
  children: string;
}

/** Renders command output as dim cyan text. */
export function SystemMessage({ children }: SystemMessageProps) {
  return <Text color="cyan">{children}</Text>;
}
