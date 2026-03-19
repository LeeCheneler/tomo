import { Text } from "ink";

interface UserMessageProps {
  children: string;
}

export function UserMessage({ children }: UserMessageProps) {
  return (
    <Text backgroundColor="gray" color="white">
      {children}
    </Text>
  );
}
