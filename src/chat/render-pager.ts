import chalk from "chalk";
import { renderMarkdown } from "../markdown/render";
import { theme } from "../ui/theme";
import type { ChatMessage, ToolCallInfo } from "./message";

/** Theme color for a diff line based on its prefix. Mirrors DiffView. */
function diffLineColor(line: string): "green" | "red" | "cyan" | null {
  if (line.startsWith("+")) return "green";
  if (line.startsWith("-")) return "red";
  if (line.startsWith("@@")) return "cyan";
  return null;
}

/** Renders diff output with colored lines (+green, -red, @@cyan). */
function renderDiff(output: string): string {
  return output
    .split("\n")
    .map((line) => {
      const color = diffLineColor(line);
      if (color === "green") return chalk.green(line);
      if (color === "red") return chalk.red(line);
      if (color === "cyan") return chalk.cyan(line);
      return chalk.dim(line);
    })
    .join("\n");
}

/** Indents each line of text by 2 spaces to match the chat list's <Indent>. */
function indent(text: string): string {
  return text
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

/** Renders a single tool call as one indented line. */
function renderToolCall(call: ToolCallInfo): string {
  const name = chalk[theme.tool](call.displayName);
  const summary = call.summary ? chalk.dim(` ${call.summary}`) : "";
  return indent(`${name}${summary}`);
}

/** Renders a single chat message as ANSI text. */
function renderMessage(message: ChatMessage): string {
  switch (message.role) {
    case "user": {
      const arrow = chalk[theme.brand]("❯ ");
      const text = chalk[theme.brand](message.content);
      const head = `${arrow}${text}`;
      if (message.images && message.images.length > 0) {
        const badges = message.images
          .map((img) => chalk.dim(`[${img.name}]`))
          .join(" ");
        return `${head}\n  ${badges}`;
      }
      return head;
    }
    case "assistant":
      return indent(renderMarkdown(message.content));
    case "interrupted":
      return indent(chalk.dim("Interrupted"));
    case "info":
      return indent(chalk.dim(message.content));
    case "error":
      return indent(chalk[theme.error](message.content));
    case "command": {
      const arrow = chalk.dim("❯ ");
      const name = chalk.dim(`/${message.command}`);
      return `${arrow}${name}\n\n${message.result}`;
    }
    case "skill": {
      const arrow = chalk[theme.skill]("❯ ");
      const text = chalk[theme.skill](`skill (${message.skillName})`);
      return `${arrow}${text}`;
    }
    case "tool-call":
      return message.toolCalls.map(renderToolCall).join("\n");
    case "tool-result": {
      const isError = message.status === "error" || message.status === "denied";
      if (message.format === "diff" && !isError) {
        return indent(renderDiff(message.output));
      }
      const colored = isError
        ? chalk[theme.error](message.output)
        : chalk.dim(message.output);
      return indent(colored);
    }
  }
}

/** Renders chat messages as a single ANSI string suitable for piping to a system pager. */
export function renderMessagesForPager(messages: ChatMessage[]): string {
  return messages.map(renderMessage).join("\n\n");
}
