import chalk from "chalk";
import { Text } from "ink";

interface UserMessageProps {
  children: string;
  imageCount?: number;
}

/** Renders a user message with a gray background for visual distinction. */
export function UserMessage({ children, imageCount }: UserMessageProps) {
  const imageLabel =
    imageCount && imageCount > 0
      ? chalk.dim(` [${imageCount} image${imageCount > 1 ? "s" : ""}]`)
      : "";
  return (
    <Text backgroundColor="gray" color="white">
      {children}
      {imageLabel}
    </Text>
  );
}
