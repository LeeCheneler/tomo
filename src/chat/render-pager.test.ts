import { describe, expect, it } from "vitest";
import { stripAnsi } from "../utils/strip-ansi";
import type { ChatMessage } from "./message";
import { renderMessagesForPager } from "./render-pager";

describe("renderMessagesForPager", () => {
  it("returns an empty string for no messages", () => {
    expect(renderMessagesForPager([])).toBe("");
  });

  it("renders a user message with the brand arrow prefix", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "user", content: "hello world" },
    ];
    const out = stripAnsi(renderMessagesForPager(messages));
    expect(out).toBe("❯ hello world");
  });

  it("includes image badges below a user message", () => {
    const messages: ChatMessage[] = [
      {
        id: "1",
        role: "user",
        content: "look at this",
        images: [
          { name: "Img 1", dataUri: "data:image/png;base64,a" },
          { name: "Img 2", dataUri: "data:image/png;base64,b" },
        ],
      },
    ];
    const out = stripAnsi(renderMessagesForPager(messages));
    expect(out).toContain("❯ look at this");
    expect(out).toContain("[Img 1]");
    expect(out).toContain("[Img 2]");
  });

  it("renders an assistant message with markdown indented", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "assistant", content: "**bold** text" },
    ];
    const out = stripAnsi(renderMessagesForPager(messages));
    expect(out).toMatch(/^ {2}/);
    expect(out).toContain("bold");
    expect(out).toContain("text");
  });

  it("renders an info message dimmed and indented", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "info", content: "Nudging to continue…" },
    ];
    const out = stripAnsi(renderMessagesForPager(messages));
    expect(out).toBe("  Nudging to continue…");
  });

  it("renders an error message indented", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "error", content: "Something broke" },
    ];
    const out = stripAnsi(renderMessagesForPager(messages));
    expect(out).toBe("  Something broke");
  });

  it("renders an interrupted notice", () => {
    const messages: ChatMessage[] = [{ id: "1", role: "interrupted" }];
    const out = stripAnsi(renderMessagesForPager(messages));
    expect(out).toBe("  Interrupted");
  });

  it("renders a command message with name and result", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "command", command: "context", result: "75% used" },
    ];
    const out = stripAnsi(renderMessagesForPager(messages));
    expect(out).toContain("❯ /context");
    expect(out).toContain("75% used");
  });

  it("renders a skill message with the skill name in parens", () => {
    const messages: ChatMessage[] = [
      {
        id: "1",
        role: "skill",
        skillName: "commit",
        content: "<skill>...</skill>",
      },
    ];
    const out = stripAnsi(renderMessagesForPager(messages));
    expect(out).toBe("❯ skill (commit)");
  });

  it("renders a tool call without a summary as just the display name", () => {
    const messages: ChatMessage[] = [
      {
        id: "1",
        role: "tool-call",
        content: "",
        toolCalls: [
          {
            id: "tc1",
            name: "ask",
            displayName: "Ask",
            arguments: "{}",
            summary: "",
          },
        ],
      },
    ];
    const out = stripAnsi(renderMessagesForPager(messages));
    expect(out).toBe("  Ask");
  });

  it("renders tool calls one per line", () => {
    const messages: ChatMessage[] = [
      {
        id: "1",
        role: "tool-call",
        content: "",
        toolCalls: [
          {
            id: "tc1",
            name: "read_file",
            displayName: "Read",
            arguments: "{}",
            summary: "src/foo.ts",
          },
          {
            id: "tc2",
            name: "grep",
            displayName: "Grep",
            arguments: "{}",
            summary: "TODO",
          },
        ],
      },
    ];
    const out = stripAnsi(renderMessagesForPager(messages));
    expect(out).toContain("Read src/foo.ts");
    expect(out).toContain("Grep TODO");
  });

  it("renders a plain tool result indented in full (no tail)", () => {
    const lines = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`);
    const messages: ChatMessage[] = [
      {
        id: "1",
        role: "tool-result",
        toolCallId: "tc1",
        toolName: "grep",
        output: lines.join("\n"),
        status: "ok",
        format: "plain",
      },
    ];
    const out = stripAnsi(renderMessagesForPager(messages));
    expect(out).toContain("line 1");
    expect(out).toContain("line 20");
    expect(out).not.toContain("more lines");
  });

  it("renders a diff tool result preserving each diff line", () => {
    const messages: ChatMessage[] = [
      {
        id: "1",
        role: "tool-result",
        toolCallId: "tc1",
        toolName: "edit_file",
        output: "@@ -1,3 +1,3 @@\n-old\n+new\n context",
        status: "ok",
        format: "diff",
      },
    ];
    const out = stripAnsi(renderMessagesForPager(messages));
    expect(out).toContain("@@ -1,3 +1,3 @@");
    expect(out).toContain("-old");
    expect(out).toContain("+new");
    expect(out).toContain("context");
  });

  it("renders a denied tool result as plain text even when format is diff", () => {
    const messages: ChatMessage[] = [
      {
        id: "1",
        role: "tool-result",
        toolCallId: "tc1",
        toolName: "edit_file",
        output: "Permission denied",
        status: "denied",
        format: "diff",
      },
    ];
    const out = stripAnsi(renderMessagesForPager(messages));
    expect(out).toContain("Permission denied");
  });

  it("separates messages with a blank line", () => {
    const messages: ChatMessage[] = [
      { id: "1", role: "user", content: "first" },
      { id: "2", role: "assistant", content: "second" },
    ];
    const out = stripAnsi(renderMessagesForPager(messages));
    const firstIdx = out.indexOf("first");
    const secondIdx = out.indexOf("second");
    expect(firstIdx).toBeGreaterThanOrEqual(0);
    expect(secondIdx).toBeGreaterThan(firstIdx);
    expect(out.slice(firstIdx, secondIdx)).toContain("\n\n");
  });
});
