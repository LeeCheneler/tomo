import { render } from "ink-testing-library";
import { describe, it, expect, vi } from "vitest";
import "../commands";
import { ChatInput } from "./chat-input";

const flush = () => new Promise((r) => setTimeout(r, 50));

describe("ChatInput", () => {
  it("renders the prompt", () => {
    const { lastFrame } = render(<ChatInput onSubmit={vi.fn()} />);
    const output = lastFrame() ?? "";
    expect(output).toContain(">");
  });

  it("displays typed characters", async () => {
    const { lastFrame, stdin } = render(<ChatInput onSubmit={vi.fn()} />);
    stdin.write("hello");
    await flush();
    const output = lastFrame() ?? "";
    expect(output).toContain("hello");
  });

  it("calls onSubmit with value on Enter", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<ChatInput onSubmit={onSubmit} />);
    stdin.write("hello");
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSubmit).toHaveBeenCalledWith("hello");
  });

  it("clears input after submit", async () => {
    const { lastFrame, stdin } = render(<ChatInput onSubmit={vi.fn()} />);
    stdin.write("hello");
    await flush();
    stdin.write("\r");
    await flush();
    const output = lastFrame() ?? "";
    expect(output).not.toContain("hello");
  });

  it("does not submit empty input", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<ChatInput onSubmit={onSubmit} />);
    stdin.write("\r");
    await flush();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not submit whitespace-only input", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<ChatInput onSubmit={onSubmit} />);
    stdin.write("   ");
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("handles backspace", async () => {
    const { lastFrame, stdin } = render(<ChatInput onSubmit={vi.fn()} />);
    stdin.write("hello");
    await flush();
    stdin.write("\x7f");
    await flush();
    const output = lastFrame() ?? "";
    expect(output).toContain("hell");
    expect(output).not.toContain("hello");
  });

  it("ignores input when disabled", async () => {
    const onSubmit = vi.fn();
    const { lastFrame, stdin } = render(
      <ChatInput onSubmit={onSubmit} disabled />,
    );
    stdin.write("hello");
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSubmit).not.toHaveBeenCalled();
    const output = lastFrame() ?? "";
    expect(output).not.toContain("hello");
  });

  it("calls onEscape on Escape key", async () => {
    const onEscape = vi.fn();
    const { stdin } = render(
      <ChatInput onSubmit={vi.fn()} onEscape={onEscape} />,
    );
    stdin.write("\x1b");
    await flush();
    expect(onEscape).toHaveBeenCalled();
  });

  it("calls onEscape even when disabled", async () => {
    const onEscape = vi.fn();
    const { stdin } = render(
      <ChatInput onSubmit={vi.fn()} disabled onEscape={onEscape} />,
    );
    stdin.write("\x1b");
    await flush();
    expect(onEscape).toHaveBeenCalled();
  });

  it("shows autocomplete suggestions when typing /", async () => {
    const { lastFrame, stdin } = render(<ChatInput onSubmit={vi.fn()} />);
    stdin.write("/");
    await flush();
    const output = lastFrame() ?? "";
    expect(output).toContain("/help");
  });

  it("shows ghost text for the top match", async () => {
    const { lastFrame, stdin } = render(<ChatInput onSubmit={vi.fn()} />);
    stdin.write("/he");
    await flush();
    const output = lastFrame() ?? "";
    // Should show "lp" as ghost text after "/he"
    expect(output).toContain("lp");
  });

  it("submits the full command on Enter with partial input", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<ChatInput onSubmit={onSubmit} />);
    stdin.write("/he");
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSubmit).toHaveBeenCalledWith("/help");
  });

  it("hides autocomplete after a space", async () => {
    const { lastFrame, stdin } = render(<ChatInput onSubmit={vi.fn()} />);
    stdin.write("/help ");
    await flush();
    const output = lastFrame() ?? "";
    // Should not show suggestion list since there's a space (args mode)
    expect(output).not.toContain("List available commands");
  });

  it("Ctrl+C clears input when text is present", async () => {
    const { lastFrame, stdin } = render(<ChatInput onSubmit={vi.fn()} />);
    stdin.write("hello");
    await flush();
    stdin.write("\x03");
    await flush();
    const output = lastFrame() ?? "";
    expect(output).not.toContain("hello");
    expect(output).not.toContain("Ctrl+C again");
  });

  it("Ctrl+C shows exit warning on empty input", async () => {
    const { lastFrame, stdin } = render(<ChatInput onSubmit={vi.fn()} />);
    stdin.write("\x03");
    await flush();
    const output = lastFrame() ?? "";
    expect(output).toContain("Ctrl+C again to close Tomo");
  });

  it("any input after exit warning dismisses it", async () => {
    const { lastFrame, stdin } = render(<ChatInput onSubmit={vi.fn()} />);
    stdin.write("\x03");
    await flush();
    expect(lastFrame()).toContain("Ctrl+C again");
    stdin.write("a");
    await flush();
    const output = lastFrame() ?? "";
    expect(output).not.toContain("Ctrl+C again");
    expect(output).toContain("a");
  });

  it("Ctrl+C does not close app on first press", async () => {
    const { lastFrame, stdin } = render(<ChatInput onSubmit={vi.fn()} />);
    stdin.write("\x03");
    await flush();
    // App should still be rendering
    const output = lastFrame() ?? "";
    expect(output).toContain("Ctrl+C again");
  });

  it("Ctrl+C shows exit warning when disabled", async () => {
    const onEscape = vi.fn();
    const { lastFrame, stdin } = render(
      <ChatInput onSubmit={vi.fn()} disabled onEscape={onEscape} />,
    );
    stdin.write("\x03");
    await flush();
    expect(onEscape).not.toHaveBeenCalled();
    expect(lastFrame()).toContain("Ctrl+C again to close Tomo");
  });
});
