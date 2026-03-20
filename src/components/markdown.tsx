import chalk from "chalk";
import { highlight } from "cli-highlight";
import { Text } from "ink";
import { Marked } from "marked";

const md = new Marked({
  renderer: {
    // Block-level
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const prefix = "#".repeat(depth);
      if (depth === 1)
        return `${chalk.magenta.bold.underline(`${prefix} ${text}`)}\n\n`;
      if (depth === 2) return `${chalk.green.bold(`${prefix} ${text}`)}\n\n`;
      return `${chalk.bold(`${prefix} ${text}`)}\n\n`;
    },
    paragraph({ tokens }) {
      return `${this.parser.parseInline(tokens)}\n\n`;
    },
    code({ text, lang }) {
      try {
        const highlighted = lang
          ? highlight(text, { language: lang })
          : highlight(text, {});
        return `${indentBlock(highlighted)}\n\n`;
      } catch {
        return `${indentBlock(text)}\n\n`;
      }
    },
    blockquote({ text }) {
      const lines = text.replace(/\n+$/, "").split("\n");
      return `${lines.map((line) => chalk.gray(`│ ${line}`)).join("\n")}\n\n`;
    },
    list({ items, ordered }) {
      const body = items
        .map((item, i) => {
          const bullet = ordered ? `${i + 1}. ` : "• ";
          const content = this.listitem(item).replace(/\n+$/, "");
          return `  ${bullet}${content}`;
        })
        .join("\n");
      return `${body}\n\n`;
    },
    listitem({ tokens }) {
      return this.parser.parse(tokens).replace(/\n+$/, "");
    },
    hr() {
      return `${chalk.dim("─".repeat(40))}\n\n`;
    },

    // Inline-level
    strong({ tokens }) {
      return chalk.bold(this.parser.parseInline(tokens));
    },
    em({ tokens }) {
      return chalk.italic(this.parser.parseInline(tokens));
    },
    codespan({ text }) {
      return chalk.yellow(text);
    },
    del({ tokens }) {
      return chalk.strikethrough(this.parser.parseInline(tokens));
    },
    link({ tokens, href }) {
      const text = this.parser.parseInline(tokens);
      return `${chalk.blue(text)} ${chalk.dim(`(${href})`)}`;
    },
    br() {
      return "\n";
    },
    html({ text }) {
      return text;
    },
  },
});

/** Indents each line of text with 4 spaces for code block display. */
function indentBlock(text: string): string {
  return text
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");
}

interface MarkdownProps {
  children: string;
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/** Replaces HTML entities (&amp; &lt; &gt; &quot; &#39;) with their literal characters. */
function unescapeHtml(text: string): string {
  return text.replace(
    /&(?:amp|lt|gt|quot|#39);/g,
    (match) => HTML_ENTITIES[match],
  );
}

/** Renders a markdown string as ANSI-formatted terminal output. */
export function Markdown({ children }: MarkdownProps) {
  const rendered = md.parse(children, { async: false }) as string;
  const trimmed = unescapeHtml(rendered.replace(/\n+$/, ""));
  return <Text>{trimmed}</Text>;
}
