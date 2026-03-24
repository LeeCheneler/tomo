import { render } from "ink-testing-library";
import { describe, it, expect, vi } from "vitest";
import "../commands";
import * as images from "../images";
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
    expect(output).toContain("help");
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

  it("moves cursor left with arrow key", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<ChatInput onSubmit={onSubmit} />);
    stdin.write("abc");
    await flush();
    // Move cursor left once (before 'c'), type 'X'
    stdin.write("\x1B[D");
    await flush();
    stdin.write("X");
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSubmit).toHaveBeenCalledWith("abXc");
  });

  it("moves cursor right with arrow key", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<ChatInput onSubmit={onSubmit} />);
    stdin.write("abc");
    await flush();
    // Move left twice, then right once
    stdin.write("\x1B[D");
    await flush();
    stdin.write("\x1B[D");
    await flush();
    stdin.write("\x1B[C");
    await flush();
    stdin.write("X");
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSubmit).toHaveBeenCalledWith("abXc");
  });

  it("backspace deletes character before cursor", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<ChatInput onSubmit={onSubmit} />);
    stdin.write("abc");
    await flush();
    // Move left once (before 'c'), backspace removes 'b'
    stdin.write("\x1B[D");
    await flush();
    stdin.write("\x7f");
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSubmit).toHaveBeenCalledWith("ac");
  });

  it("Ctrl+A moves cursor to start", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<ChatInput onSubmit={onSubmit} />);
    stdin.write("abc");
    await flush();
    stdin.write("\x01"); // Ctrl+A
    await flush();
    stdin.write("X");
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSubmit).toHaveBeenCalledWith("Xabc");
  });

  it("Ctrl+E moves cursor to end", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<ChatInput onSubmit={onSubmit} />);
    stdin.write("abc");
    await flush();
    stdin.write("\x01"); // Ctrl+A (go to start)
    await flush();
    stdin.write("\x05"); // Ctrl+E (go to end)
    await flush();
    stdin.write("X");
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSubmit).toHaveBeenCalledWith("abcX");
  });

  it("cursor does not move past start", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<ChatInput onSubmit={onSubmit} />);
    stdin.write("ab");
    await flush();
    // Move left 5 times (more than string length)
    for (let i = 0; i < 5; i++) {
      stdin.write("\x1B[D");
      await flush();
    }
    stdin.write("X");
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSubmit).toHaveBeenCalledWith("Xab");
  });

  it("up arrow moves cursor to previous line at same column", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<ChatInput onSubmit={onSubmit} />);
    // Type "abc", newline, "defgh" — cursor ends at position 9 (end of "defgh")
    stdin.write("abc");
    await flush();
    // Shift+Enter for newline
    stdin.write("\x1B[13;2u");
    await flush();
    stdin.write("defgh");
    await flush();
    // Up arrow should move to line 1, column clamped to line length
    stdin.write("\x1B[A");
    await flush();
    stdin.write("X");
    await flush();
    stdin.write("\r");
    await flush();
    // Cursor was at col 5 on line 2, line 1 is "abc" (length 3), so clamp to col 3
    expect(onSubmit).toHaveBeenCalledWith("abcX\ndefgh");
  });

  it("down arrow moves cursor to next line at same column", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<ChatInput onSubmit={onSubmit} />);
    stdin.write("abcde");
    await flush();
    stdin.write("\x1B[13;2u");
    await flush();
    stdin.write("fg");
    await flush();
    // Go to start of first line
    stdin.write("\x01");
    await flush();
    // Move right 2 (cursor on 'c', col 2)
    stdin.write("\x1B[C");
    await flush();
    stdin.write("\x1B[C");
    await flush();
    // Down arrow should move to line 2, col 2 (on end since "fg" is len 2)
    stdin.write("\x1B[B");
    await flush();
    stdin.write("X");
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSubmit).toHaveBeenCalledWith("abcde\nfgX");
  });

  it("up arrow does nothing on first line", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<ChatInput onSubmit={onSubmit} />);
    stdin.write("abc");
    await flush();
    stdin.write("\x1B[A");
    await flush();
    stdin.write("X");
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSubmit).toHaveBeenCalledWith("abcX");
  });

  it("down arrow does nothing on last line", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<ChatInput onSubmit={onSubmit} />);
    stdin.write("abc");
    await flush();
    stdin.write("\x1B[B");
    await flush();
    stdin.write("X");
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSubmit).toHaveBeenCalledWith("abcX");
  });

  it("Option+Left skips to previous word boundary", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<ChatInput onSubmit={onSubmit} />);
    stdin.write("hello world foo");
    await flush();
    // Alt+B / Option+Left — skip back one word
    stdin.write("\x1bb");
    await flush();
    stdin.write("X");
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSubmit).toHaveBeenCalledWith("hello world Xfoo");
  });

  it("Option+Right skips to next word boundary", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<ChatInput onSubmit={onSubmit} />);
    stdin.write("hello world");
    await flush();
    // Go to start
    stdin.write("\x01");
    await flush();
    // Alt+F / Option+Right — skip forward one word
    stdin.write("\x1bf");
    await flush();
    stdin.write("X");
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSubmit).toHaveBeenCalledWith("helloX world");
  });

  it("Ctrl+W deletes previous word", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<ChatInput onSubmit={onSubmit} />);
    stdin.write("hello world foo");
    await flush();
    stdin.write("\x17"); // Ctrl+W
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSubmit).toHaveBeenCalledWith("hello world ");
  });

  it("Ctrl+W deletes previous word from middle of text", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<ChatInput onSubmit={onSubmit} />);
    stdin.write("hello world foo");
    await flush();
    // Move cursor back to end of "world" (skip " foo" = 4 chars)
    stdin.write("\x1B[D\x1B[D\x1B[D\x1B[D");
    await flush();
    stdin.write("\x17"); // Ctrl+W
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSubmit).toHaveBeenCalledWith("hello  foo");
  });

  it("Option+Backspace deletes previous word", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<ChatInput onSubmit={onSubmit} />);
    stdin.write("hello world foo");
    await flush();
    stdin.write("\x1b\x7f"); // Option+Backspace
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSubmit).toHaveBeenCalledWith("hello world ");
  });

  it("Ctrl+W does nothing at start of input", async () => {
    const onSubmit = vi.fn();
    const { stdin } = render(<ChatInput onSubmit={onSubmit} />);
    stdin.write("hello");
    await flush();
    stdin.write("\x01"); // Ctrl+A — go to start
    await flush();
    stdin.write("\x17"); // Ctrl+W
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSubmit).toHaveBeenCalledWith("hello");
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

  it("Ctrl+V pastes clipboard image and shows tag", async () => {
    const mockImage = {
      name: "clipboard.png",
      dataUri: "data:image/png;base64,abc",
    };
    vi.spyOn(images, "readClipboardImage").mockReturnValue(mockImage);

    const { lastFrame, stdin } = render(<ChatInput onSubmit={vi.fn()} />);
    // Ctrl+V
    stdin.write("\x16");
    await flush();
    const output = lastFrame() ?? "";
    expect(output).toContain("[Img 1]");

    vi.restoreAllMocks();
  });

  it("Ctrl+V with no clipboard image does nothing", async () => {
    vi.spyOn(images, "readClipboardImage").mockReturnValue(null);

    const { lastFrame, stdin } = render(<ChatInput onSubmit={vi.fn()} />);
    stdin.write("\x16");
    await flush();
    const output = lastFrame() ?? "";
    expect(output).not.toContain("[Img");

    vi.restoreAllMocks();
  });

  it("Ctrl+C clears clipboard images", async () => {
    const mockImage = {
      name: "clipboard.png",
      dataUri: "data:image/png;base64,abc",
    };
    vi.spyOn(images, "readClipboardImage").mockReturnValue(mockImage);

    const { lastFrame, stdin } = render(<ChatInput onSubmit={vi.fn()} />);
    stdin.write("\x16");
    await flush();
    expect(lastFrame()).toContain("[Img 1]");
    // Ctrl+C to clear
    stdin.write("\x03");
    await flush();
    expect(lastFrame()).not.toContain("[Img");

    vi.restoreAllMocks();
  });

  it("passes clipboard images through onSubmit", async () => {
    const mockImage = {
      name: "clipboard.png",
      dataUri: "data:image/png;base64,abc",
    };
    vi.spyOn(images, "readClipboardImage").mockReturnValue(mockImage);

    const onSubmit = vi.fn();
    const { stdin } = render(<ChatInput onSubmit={onSubmit} />);
    // Paste image then type and submit
    stdin.write("\x16");
    await flush();
    stdin.write("describe this");
    await flush();
    stdin.write("\r");
    await flush();
    expect(onSubmit).toHaveBeenCalledWith("describe this", [mockImage]);

    vi.restoreAllMocks();
  });

  it("shows down arrow hint when clipboard images are present", async () => {
    const mockImage = {
      name: "clipboard.png",
      dataUri: "data:image/png;base64,abc",
    };
    vi.spyOn(images, "readClipboardImage").mockReturnValue(mockImage);

    const { lastFrame, stdin } = render(<ChatInput onSubmit={vi.fn()} />);
    stdin.write("\x16");
    await flush();
    expect(lastFrame()).toContain("↓ images");

    vi.restoreAllMocks();
  });

  it("enters image nav on down arrow and shows nav hints", async () => {
    const mockImage = {
      name: "clipboard.png",
      dataUri: "data:image/png;base64,abc",
    };
    vi.spyOn(images, "readClipboardImage").mockReturnValue(mockImage);

    const { lastFrame, stdin } = render(<ChatInput onSubmit={vi.fn()} />);
    stdin.write("\x16");
    await flush();
    // Down arrow to enter image nav
    stdin.write("\x1B[B");
    await flush();
    const output = lastFrame() ?? "";
    expect(output).toContain("←→ select");
    expect(output).toContain("⌫ remove");

    vi.restoreAllMocks();
  });

  it("exits image nav on up arrow", async () => {
    const mockImage = {
      name: "clipboard.png",
      dataUri: "data:image/png;base64,abc",
    };
    vi.spyOn(images, "readClipboardImage").mockReturnValue(mockImage);

    const { lastFrame, stdin } = render(<ChatInput onSubmit={vi.fn()} />);
    stdin.write("\x16");
    await flush();
    // Enter nav
    stdin.write("\x1B[B");
    await flush();
    expect(lastFrame()).toContain("←→ select");
    // Exit nav
    stdin.write("\x1B[A");
    await flush();
    expect(lastFrame()).toContain("↓ images");

    vi.restoreAllMocks();
  });

  it("removes clipboard image with backspace in image nav", async () => {
    const mockImage = {
      name: "clipboard.png",
      dataUri: "data:image/png;base64,abc",
    };
    vi.spyOn(images, "readClipboardImage").mockReturnValue(mockImage);

    const { lastFrame, stdin } = render(<ChatInput onSubmit={vi.fn()} />);
    stdin.write("\x16");
    await flush();
    expect(lastFrame()).toContain("[Img 1]");
    // Enter nav then backspace to remove
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\x7f");
    await flush();
    expect(lastFrame()).not.toContain("[Img");
    // Should exit nav since no images left
    expect(lastFrame()).not.toContain("←→ select");

    vi.restoreAllMocks();
  });

  it("shows multiple image tags for multiple clipboard pastes", async () => {
    const mockImage = {
      name: "clipboard.png",
      dataUri: "data:image/png;base64,abc",
    };
    vi.spyOn(images, "readClipboardImage").mockReturnValue(mockImage);

    const { lastFrame, stdin } = render(<ChatInput onSubmit={vi.fn()} />);
    stdin.write("\x16");
    await flush();
    stdin.write("\x16");
    await flush();
    const output = lastFrame() ?? "";
    expect(output).toContain("[Img 1]");
    expect(output).toContain("[Img 2]");

    vi.restoreAllMocks();
  });
});
