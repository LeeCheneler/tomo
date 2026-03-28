import { render } from "ink-testing-library";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "../session";
import { SessionSelector } from "./session-selector";

const flush = () => new Promise((r) => setTimeout(r, 50));

function makeSession(
  id: string,
  createdAt: string,
  firstMessage?: string,
): Session {
  return {
    id,
    createdAt,
    updatedAt: createdAt,
    provider: "ollama",
    model: "qwen3:8b",
    messages: firstMessage
      ? [{ id: `msg-${id}`, role: "user", content: firstMessage }]
      : [],
  };
}

vi.mock("../session", () => ({
  listSessions: vi.fn(() => []),
}));

const { listSessions } = await import("../session");
const mockListSessions = vi.mocked(listSessions);

describe("SessionSelector", () => {
  beforeEach(() => {
    mockListSessions.mockReturnValue([]);
  });

  it("shows empty state when no sessions exist", () => {
    const { lastFrame } = render(
      <SessionSelector onSelect={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(lastFrame()).toContain("No previous sessions");
  });

  it("renders session list with date and message preview", () => {
    mockListSessions.mockReturnValue([
      makeSession("s1", "2026-03-20T14:30:00.000Z", "Hello there"),
      makeSession("s2", "2026-03-19T09:15:00.000Z", "Another chat"),
    ]);
    const { lastFrame } = render(
      <SessionSelector onSelect={vi.fn()} onCancel={vi.fn()} />,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("Hello there");
    expect(output).toContain("Another chat");
  });

  it("shows (empty) for sessions with no messages", () => {
    mockListSessions.mockReturnValue([
      makeSession("s1", "2026-03-20T14:30:00.000Z"),
    ]);
    const { lastFrame } = render(
      <SessionSelector onSelect={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(lastFrame()).toContain("(empty)");
  });

  it("truncates long message previews", () => {
    const longMessage = "a".repeat(100);
    mockListSessions.mockReturnValue([
      makeSession("s1", "2026-03-20T14:30:00.000Z", longMessage),
    ]);
    const { lastFrame } = render(
      <SessionSelector onSelect={vi.fn()} onCancel={vi.fn()} />,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("...");
    expect(output).not.toContain(longMessage);
  });

  it("calls onSelect with session ID on Enter", async () => {
    mockListSessions.mockReturnValue([
      makeSession("s1", "2026-03-20T14:30:00.000Z", "First"),
      makeSession("s2", "2026-03-19T09:15:00.000Z", "Second"),
    ]);
    const onSelect = vi.fn();
    const { stdin } = render(
      <SessionSelector onSelect={onSelect} onCancel={vi.fn()} />,
    );
    // Cursor starts on first session
    stdin.write("\r");
    await flush();
    expect(onSelect).toHaveBeenCalledWith("s1");
  });

  it("navigates down and selects", async () => {
    mockListSessions.mockReturnValue([
      makeSession("s1", "2026-03-20T14:30:00.000Z", "First"),
      makeSession("s2", "2026-03-19T09:15:00.000Z", "Second"),
    ]);
    const onSelect = vi.fn();
    const { stdin } = render(
      <SessionSelector onSelect={onSelect} onCancel={vi.fn()} />,
    );
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSelect).toHaveBeenCalledWith("s2");
  });

  it("calls onCancel on Escape", async () => {
    mockListSessions.mockReturnValue([
      makeSession("s1", "2026-03-20T14:30:00.000Z", "Hello"),
    ]);
    const onCancel = vi.fn();
    const { stdin } = render(
      <SessionSelector onSelect={vi.fn()} onCancel={onCancel} />,
    );
    stdin.write("\x1B");
    await flush();
    expect(onCancel).toHaveBeenCalled();
  });

  it("does not scroll past the last session", async () => {
    mockListSessions.mockReturnValue([
      makeSession("s1", "2026-03-20T14:30:00.000Z", "First"),
      makeSession("s2", "2026-03-19T09:15:00.000Z", "Second"),
    ]);
    const onSelect = vi.fn();
    const { stdin } = render(
      <SessionSelector onSelect={onSelect} onCancel={vi.fn()} />,
    );
    // Move down past the last item
    stdin.write("\x1B[B");
    stdin.write("\x1B[B");
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\r");
    await flush();
    // Should still be on the last session
    expect(onSelect).toHaveBeenCalledWith("s2");
  });

  it("does not scroll past the first session", async () => {
    mockListSessions.mockReturnValue([
      makeSession("s1", "2026-03-20T14:30:00.000Z", "First"),
      makeSession("s2", "2026-03-19T09:15:00.000Z", "Second"),
    ]);
    const onSelect = vi.fn();
    const { stdin } = render(
      <SessionSelector onSelect={onSelect} onCancel={vi.fn()} />,
    );
    // Try to go up from the top
    stdin.write("\x1B[A");
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSelect).toHaveBeenCalledWith("s1");
  });

  it("shows only 5 sessions at a time and scrolls the window", async () => {
    const sessions = Array.from({ length: 8 }, (_, i) =>
      makeSession(
        `s${i}`,
        `2026-03-${String(20 - i).padStart(2, "0")}T10:00:00.000Z`,
        `Message ${i}`,
      ),
    );
    mockListSessions.mockReturnValue(sessions);
    const { lastFrame, stdin } = render(
      <SessionSelector onSelect={vi.fn()} onCancel={vi.fn()} />,
    );

    let output = lastFrame() ?? "";
    // First 5 should be visible
    expect(output).toContain("Message 0");
    expect(output).toContain("Message 4");
    expect(output).not.toContain("Message 5");

    // Move down to item 6 (index 5) to trigger scroll
    for (let i = 0; i < 5; i++) {
      stdin.write("\x1B[B");
      await flush();
    }

    output = lastFrame() ?? "";
    // Window should have shifted: items 1-5 visible
    expect(output).not.toContain("Message 0");
    expect(output).toContain("Message 1");
    expect(output).toContain("Message 5");
  });

  it("shows navigation instructions", () => {
    mockListSessions.mockReturnValue([
      makeSession("s1", "2026-03-20T14:30:00.000Z", "Hello"),
    ]);
    const { lastFrame } = render(
      <SessionSelector onSelect={vi.fn()} onCancel={vi.fn()} />,
    );
    const output = lastFrame() ?? "";
    expect(output).toContain("navigate");
    expect(output).toContain("Enter");
    expect(output).toContain("Esc");
  });
});
