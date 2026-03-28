import { render } from "ink-testing-library";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { TextInput } from "./text-input";

const flush = () => new Promise((r) => setTimeout(r, 50));

function TestWrapper({
  initial = "",
  masked,
  onValue,
}: {
  initial?: string;
  masked?: boolean;
  onValue?: (v: string) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <TextInput
      value={value}
      onChange={(v) => {
        setValue(v);
        onValue?.(v);
      }}
      masked={masked}
    />
  );
}

describe("TextInput", () => {
  it("renders initial value", () => {
    const { lastFrame } = render(<TestWrapper initial="hello" />);
    expect(lastFrame()).toContain("hello");
  });

  it("renders typed characters", async () => {
    const { lastFrame, stdin } = render(<TestWrapper />);
    stdin.write("abc");
    await flush();
    expect(lastFrame()).toContain("abc");
  });

  it("masks value when masked is true", async () => {
    const { lastFrame, stdin } = render(<TestWrapper masked />);
    stdin.write("secret");
    await flush();
    const output = lastFrame() ?? "";
    expect(output).toContain("******");
    expect(output).not.toContain("secret");
  });

  it("moves cursor left and inserts at position", async () => {
    const onValue = vi.fn();
    const { stdin } = render(<TestWrapper onValue={onValue} />);
    stdin.write("abc");
    await flush();
    stdin.write("\x1B[D"); // left arrow
    await flush();
    stdin.write("X");
    await flush();
    expect(onValue).toHaveBeenLastCalledWith("abXc");
  });

  it("moves cursor right after moving left", async () => {
    const onValue = vi.fn();
    const { stdin } = render(<TestWrapper onValue={onValue} />);
    stdin.write("abc");
    await flush();
    stdin.write("\x1B[D"); // left
    await flush();
    stdin.write("\x1B[D"); // left
    await flush();
    stdin.write("\x1B[C"); // right
    await flush();
    stdin.write("X");
    await flush();
    expect(onValue).toHaveBeenLastCalledWith("abXc");
  });

  it("Ctrl+A moves cursor to start", async () => {
    const onValue = vi.fn();
    const { stdin } = render(<TestWrapper onValue={onValue} />);
    stdin.write("hello");
    await flush();
    stdin.write("\x01"); // Ctrl+A
    await flush();
    stdin.write("X");
    await flush();
    expect(onValue).toHaveBeenLastCalledWith("Xhello");
  });

  it("Ctrl+E moves cursor to end", async () => {
    const onValue = vi.fn();
    const { stdin } = render(<TestWrapper onValue={onValue} />);
    stdin.write("hello");
    await flush();
    stdin.write("\x01"); // Ctrl+A
    await flush();
    stdin.write("\x05"); // Ctrl+E
    await flush();
    stdin.write("X");
    await flush();
    expect(onValue).toHaveBeenLastCalledWith("helloX");
  });

  it("backspace deletes character before cursor", async () => {
    const onValue = vi.fn();
    const { stdin } = render(<TestWrapper onValue={onValue} />);
    stdin.write("abc");
    await flush();
    stdin.write("\x7f"); // backspace
    await flush();
    expect(onValue).toHaveBeenLastCalledWith("ab");
  });

  it("Ctrl+W deletes previous word", async () => {
    const onValue = vi.fn();
    const { stdin } = render(<TestWrapper onValue={onValue} />);
    stdin.write("hello world");
    await flush();
    stdin.write("\x17"); // Ctrl+W
    await flush();
    expect(onValue).toHaveBeenLastCalledWith("hello ");
  });

  it("Alt+Left skips to previous word boundary", async () => {
    const onValue = vi.fn();
    const { stdin } = render(<TestWrapper onValue={onValue} />);
    stdin.write("hello world");
    await flush();
    stdin.write("\x1bb"); // Alt+B
    await flush();
    stdin.write("X");
    await flush();
    expect(onValue).toHaveBeenLastCalledWith("hello Xworld");
  });

  it("does not crash on backspace at start", async () => {
    const onValue = vi.fn();
    const { stdin } = render(<TestWrapper onValue={onValue} />);
    stdin.write("a");
    await flush();
    stdin.write("\x01"); // Ctrl+A
    await flush();
    stdin.write("\x7f"); // backspace at position 0
    await flush();
    // Value should not have changed from the backspace
    expect(onValue).toHaveBeenLastCalledWith("a");
  });

  it("cursor does not go past boundaries", async () => {
    const onValue = vi.fn();
    const { stdin } = render(<TestWrapper onValue={onValue} />);
    stdin.write("ab");
    await flush();
    // Move right past end
    stdin.write("\x1B[C");
    await flush();
    stdin.write("\x1B[C");
    await flush();
    // Move left past start
    stdin.write("\x1B[D");
    await flush();
    stdin.write("\x1B[D");
    await flush();
    stdin.write("\x1B[D");
    await flush();
    stdin.write("\x1B[D");
    await flush();
    stdin.write("X");
    await flush();
    expect(onValue).toHaveBeenLastCalledWith("Xab");
  });
});
