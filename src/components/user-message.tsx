import { Text } from "ink";

interface UserMessageProps {
  children: string;
}

/** Renders a user message with a gray background for visual distinction. */
export function UserMessage({ children }: UserMessageProps) {
  return (
    <Text backgroundColor="gray" color="white">
      {children}
    </Text>
  );
}
