import { Markdown } from "./markdown";

interface AssistantMessageProps {
  children: string;
}

export function AssistantMessage({ children }: AssistantMessageProps) {
  return children ? <Markdown>{children}</Markdown> : null;
}
