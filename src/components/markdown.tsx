import chalk from "chalk";
import { highlight } from "cli-highlight";
import { Text } from "ink";
import { Marked } from "marked";
// biome-ignore lint/suspicious/noControlCharactersInRegex: matching ANSI escape codes requires control characters
const ANSI_REGEX = /\x1b\[[0-9;]*m/g;

/** Strips ANSI escape codes to get the visible character length. */
function stripAnsi(str: string): string {
  return str.replace(ANSI_REGEX, "");
}

/** Pads a string to a visible width, accounting for ANSI codes. */
function padEnd(str: string, width: number): string {
  const visible = stripAnsi(str).length;
  return str + " ".repeat(Math.max(0, width - visible));
}

/** Renders structured table data (headers + rows) as a box-drawn terminal table. */
function renderTableData(headers: string[], rows: string[][]): string {
  const colWidths = headers.map((h, i) => {
    const cellWidths = rows.map((row) => stripAnsi(row[i] ?? "").length);
    return Math.max(stripAnsi(h).length, ...cellWidths);
  });

  const top = `┌${colWidths.map((w) => "─".repeat(w + 2)).join("┬")}┐`;
  const mid = `├${colWidths.map((w) => "─".repeat(w + 2)).join("┼")}┤`;
  const bot = `└${colWidths.map((w) => "─".repeat(w + 2)).join("┴")}┘`;

  const headerRow = `│${headers.map((h, i) => ` ${chalk.bold(padEnd(h, colWidths[i] as number))} `).join("│")}│`;
  const dataRows = rows.map(
    (row) =>
      `│${row.map((cell, i) => ` ${padEnd(cell, colWidths[i] as number)} `).join("│")}│`,
  );

  return [
    chalk.dim(top),
    headerRow,
    chalk.dim(mid),
    ...dataRows,
    chalk.dim(bot),
  ].join("\n");
}

/**
 * Extracts text content from an HTML table string.
 * Returns rows of cell text, with the first row being the header.
 */
function parseHtmlTable(html: string): string[][] | null {
  const rowMatches = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
  if (!rowMatches) return null;

  const rows: string[][] = [];
  for (const rowHtml of rowMatches) {
    const cellMatches = rowHtml.match(
      /<(?:td|th)[^>]*>[\s\S]*?<\/(?:td|th)>/gi,
    );
    if (!cellMatches) continue;
    const cells = cellMatches.map((c) => c.replace(/<[^>]*>/g, "").trim());
    if (cells.length > 0) rows.push(cells);
  }
  return rows.length > 0 ? rows : null;
}

/** Renders parsed HTML table rows as a box-drawn terminal table. */
function renderHtmlTable(rows: string[][]): string {
  const [header, ...dataRows] = rows;
  return renderTableData(header as string[], dataRows);
}

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
    table(token) {
      const headers = token.header.map((cell) =>
        this.parser.parseInline(cell.tokens),
      );
      const rows = token.rows.map((row) =>
        row.map((cell) => this.parser.parseInline(cell.tokens)),
      );
      return `${renderTableData(headers, rows)}\n\n`;
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
      const tableRows = parseHtmlTable(text);
      if (tableRows) return `${renderHtmlTable(tableRows)}\n\n`;
      // Strip remaining HTML tags, keep text content
      return text.replace(/<[^>]*>/g, "").trim();
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

/**
 * Closes unclosed code fences in partial markdown so streaming content
 * renders as a code block instead of plain text while the response is
 * still arriving.
 */
export function completePartialMarkdown(text: string): string {
  const lines = text.split("\n");
  let inCodeBlock = false;
  let fenceChar = "";
  let fenceLength = 0;

  for (const line of lines) {
    const trimmed = line.trimStart();
    if (!inCodeBlock) {
      const match = trimmed.match(/^(`{3,}|~{3,})/);
      if (match) {
        inCodeBlock = true;
        fenceChar = match[1][0];
        fenceLength = match[1].length;
      }
    } else {
      const match = trimmed.match(/^(`{3,}|~{3,})\s*$/);
      if (
        match &&
        match[1][0] === fenceChar &&
        match[1].length >= fenceLength
      ) {
        inCodeBlock = false;
      }
    }
  }

  if (inCodeBlock) {
    return `${text}\n${fenceChar.repeat(fenceLength)}`;
  }

  return text;
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

/** Renders a markdown string to ANSI-formatted text. */
export function renderMarkdown(text: string): string {
  const rendered = md.parse(text, { async: false }) as string;
  return unescapeHtml(rendered.replace(/\n+$/, ""));
}

/** Renders a markdown string as ANSI-formatted terminal output. */
export function Markdown({ children }: MarkdownProps) {
  return <Text>{renderMarkdown(children)}</Text>;
}
