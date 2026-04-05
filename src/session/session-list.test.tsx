import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "ink-testing-library";
import type { CommandContext } from "../commands/registry";
import { mockFs } from "../test-utils/mock-fs";
import { keys } from "../test-utils/keys";
import { flushInkFrames } from "../test-utils/ink";
import { SESSIONS_DIR } from "./session";
import { SessionList } from "./session-list";

vi.mock("node:os", async (importOriginal) => ({
  ...(await importOriginal<typeof import("node:os")>()),
  homedir: () => "/mock-home",
}));

/** Builds a session file path from a filename. */
function sessionPath(filename: string): string {
  return `${SESSIONS_DIR}/${filename}`;
}

/** Builds a JSONL line for a user message. */
function userLine(content: string): string {
  return JSON.stringify({ id: "1", role: "user", content });
}

/** Creates a stub CommandContext with spy functions. */
function stubContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    usage: null,
    contextWindow: 8192,
    resetSession: vi.fn(),
    loadSession: vi.fn(),
    ...overrides,
  };
}

describe("SessionList", () => {
  describe("with no sessions", () => {
    let fs: ReturnType<typeof mockFs>;

    afterEach(() => {
      fs.restore();
    });

    it("shows empty state message", () => {
      fs = mockFs();
      const onDone = vi.fn();
      const { lastFrame } = render(
        <SessionList onDone={onDone} context={stubContext()} />,
      );
      expect(lastFrame()).toContain("No saved sessions");
    });

    it("calls onDone on escape", async () => {
      fs = mockFs();
      const onDone = vi.fn();
      const { stdin } = render(
        <SessionList onDone={onDone} context={stubContext()} />,
      );
      stdin.write(keys.escape);
      await flushInkFrames();
      expect(onDone).toHaveBeenCalledOnce();
    });

    it("ignores non-escape keys", async () => {
      fs = mockFs();
      const onDone = vi.fn();
      const { stdin } = render(
        <SessionList onDone={onDone} context={stubContext()} />,
      );
      stdin.write("x");
      await flushInkFrames();
      expect(onDone).not.toHaveBeenCalled();
    });
  });

  describe("with sessions", () => {
    const NEWER_PATH = sessionPath(
      "2026-04-05T19-45-00-000Z-aaaa-bbbb-cccc-dddd-ffffffffffff.jsonl",
    );

    const FILES = {
      [sessionPath(
        "2026-04-01T10-00-00-000Z-aaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jsonl",
      )]: `${userLine("older session message")}\n`,
      [NEWER_PATH]: `${userLine("newer session message")}\n`,
    };

    let fs: ReturnType<typeof mockFs>;

    afterEach(() => {
      fs.restore();
    });

    it("shows session list with formatted dates and message previews", () => {
      fs = mockFs(FILES);
      const onDone = vi.fn();
      const { lastFrame } = render(
        <SessionList onDone={onDone} context={stubContext()} />,
      );
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Sessions");
      expect(frame).toContain("newer session message");
      expect(frame).toContain("older session message");
    });

    it("shows newest session first with cursor", () => {
      fs = mockFs(FILES);
      const onDone = vi.fn();
      const { lastFrame } = render(
        <SessionList onDone={onDone} context={stubContext()} />,
      );
      const frame = lastFrame() ?? "";
      const lines = frame.split("\n");
      const cursorLine = lines.find((l) => l.includes("❯"));
      expect(cursorLine).toContain("newer session message");
    });

    it("formats date using Intl formatter", () => {
      fs = mockFs(FILES);
      const onDone = vi.fn();
      const { lastFrame } = render(
        <SessionList onDone={onDone} context={stubContext()} />,
      );
      const frame = lastFrame() ?? "";
      const expected = new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(new Date("2026-04-05T19:45:00.000Z"));
      expect(frame).toContain(expected);
    });

    it("truncates long messages to 50 characters", () => {
      const longMessage = "a".repeat(80);
      fs = mockFs({
        [sessionPath(
          "2026-04-05T19-45-00-000Z-aaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jsonl",
        )]: `${userLine(longMessage)}\n`,
      });
      const onDone = vi.fn();
      const { lastFrame } = render(
        <SessionList onDone={onDone} context={stubContext()} />,
      );
      const frame = lastFrame() ?? "";
      expect(frame).toContain(`${"a".repeat(50)}...`);
      expect(frame).not.toContain("a".repeat(51));
    });

    it("shows (empty session) for sessions with no user messages", () => {
      fs = mockFs({
        [sessionPath(
          "2026-04-05T19-45-00-000Z-aaaa-bbbb-cccc-dddd-eeeeeeeeeeee.jsonl",
        )]:
          `${JSON.stringify({ id: "1", role: "command", command: "new", result: "done" })}\n`,
      });
      const onDone = vi.fn();
      const { lastFrame } = render(
        <SessionList onDone={onDone} context={stubContext()} />,
      );
      expect(lastFrame()).toContain("(empty session)");
    });

    it("navigates between sessions", async () => {
      fs = mockFs(FILES);
      const onDone = vi.fn();
      const { stdin, lastFrame } = render(
        <SessionList onDone={onDone} context={stubContext()} />,
      );
      stdin.write(keys.down);
      await flushInkFrames();
      const lines = (lastFrame() ?? "").split("\n");
      const cursorLine = lines.find((l) => l.includes("❯"));
      expect(cursorLine).toContain("older session message");
    });

    it("calls onDone on escape", async () => {
      fs = mockFs(FILES);
      const onDone = vi.fn();
      const { stdin } = render(
        <SessionList onDone={onDone} context={stubContext()} />,
      );
      stdin.write(keys.escape);
      await flushInkFrames();
      expect(onDone).toHaveBeenCalledOnce();
    });

    it("calls loadSession with the selected path and exits", async () => {
      fs = mockFs(FILES);
      const onDone = vi.fn();
      const loadSession = vi.fn();
      const { stdin } = render(
        <SessionList onDone={onDone} context={stubContext({ loadSession })} />,
      );
      // First item is newest session
      stdin.write(keys.enter);
      await flushInkFrames();
      expect(loadSession).toHaveBeenCalledWith(NEWER_PATH);
      expect(onDone).toHaveBeenCalledOnce();
    });
  });
});
