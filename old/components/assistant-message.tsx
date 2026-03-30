import { Markdown } from "./markdown";

interface AssistantMessageProps {
  children: string;
}

/** Renders an assistant message with markdown formatting. */
export function AssistantMessage({ children }: AssistantMessageProps) {
  return children ? <Markdown>{children}</Markdown> : null;
}
