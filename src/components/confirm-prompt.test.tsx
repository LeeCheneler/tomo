import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import { ConfirmPrompt } from "./confirm-prompt";
import { Text } from "ink";

const flush = () => new Promise((r) => setTimeout(r, 50));

describe("ConfirmPrompt", () => {
  it("renders title, children, and options", () => {
    const { lastFrame } = render(
      <ConfirmPrompt
        title="Test?"
        options={[
          { label: "Yes", shortcut: "y", color: "green", onSelect: vi.fn() },
          { label: "No", shortcut: "n", color: "red", onSelect: vi.fn() },
        ]}
      >
        <Text>{"  detail line"}</Text>
      </ConfirmPrompt>,
    );

    const output = lastFrame();
    expect(output).toContain("Test?");
    expect(output).toContain("detail line");
    expect(output).toContain("Yes (y)");
    expect(output).toContain("No (n)");
  });

  it("calls matching option on shortcut key", async () => {
    const onApprove = vi.fn();
    const { stdin } = render(
      <ConfirmPrompt
        title="Test?"
        options={[
          { label: "Yes", shortcut: "y", color: "green", onSelect: onApprove },
          { label: "No", shortcut: "n", color: "red", onSelect: vi.fn() },
        ]}
      />,
    );

    stdin.write("y");
    await flush();
    expect(onApprove).toHaveBeenCalled();
  });

  it("shortcut is case-insensitive", async () => {
    const onApprove = vi.fn();
    const { stdin } = render(
      <ConfirmPrompt
        title="Test?"
        options={[
          { label: "Yes", shortcut: "y", color: "green", onSelect: onApprove },
          { label: "No", shortcut: "n", color: "red", onSelect: vi.fn() },
        ]}
      />,
    );

    stdin.write("Y");
    await flush();
    expect(onApprove).toHaveBeenCalled();
  });

  it("escape triggers the last option", async () => {
    const onDeny = vi.fn();
    const { stdin } = render(
      <ConfirmPrompt
        title="Test?"
        options={[
          { label: "Yes", shortcut: "y", color: "green", onSelect: vi.fn() },
          { label: "No", shortcut: "n", color: "red", onSelect: onDeny },
        ]}
      />,
    );

    stdin.write("\x1B");
    await flush();
    expect(onDeny).toHaveBeenCalled();
  });

  it("enter selects the option at cursor (default first)", async () => {
    const onApprove = vi.fn();
    const { stdin } = render(
      <ConfirmPrompt
        title="Test?"
        options={[
          { label: "Yes", shortcut: "y", color: "green", onSelect: onApprove },
          { label: "No", shortcut: "n", color: "red", onSelect: vi.fn() },
        ]}
      />,
    );

    stdin.write("\r");
    await flush();
    expect(onApprove).toHaveBeenCalled();
  });

  it("arrow keys move cursor and enter selects", async () => {
    const onDeny = vi.fn();
    const { stdin } = render(
      <ConfirmPrompt
        title="Test?"
        options={[
          { label: "Yes", shortcut: "y", color: "green", onSelect: vi.fn() },
          { label: "No", shortcut: "n", color: "red", onSelect: onDeny },
        ]}
      />,
    );

    stdin.write("\x1B[B"); // down to No
    await flush();
    stdin.write("\r");
    await flush();
    expect(onDeny).toHaveBeenCalled();
  });

  it("cursor wraps around downward", async () => {
    const onApprove = vi.fn();
    const { stdin } = render(
      <ConfirmPrompt
        title="Test?"
        options={[
          { label: "Yes", shortcut: "y", color: "green", onSelect: onApprove },
          { label: "No", shortcut: "n", color: "red", onSelect: vi.fn() },
        ]}
      />,
    );

    stdin.write("\x1B[B"); // down to No
    await flush();
    stdin.write("\x1B[B"); // wrap to Yes
    await flush();
    stdin.write("\r");
    await flush();
    expect(onApprove).toHaveBeenCalled();
  });

  it("cursor wraps around upward", async () => {
    const onDeny = vi.fn();
    const { stdin } = render(
      <ConfirmPrompt
        title="Test?"
        options={[
          { label: "Yes", shortcut: "y", color: "green", onSelect: vi.fn() },
          { label: "No", shortcut: "n", color: "red", onSelect: onDeny },
        ]}
      />,
    );

    stdin.write("\x1B[A"); // up wraps to No
    await flush();
    stdin.write("\r");
    await flush();
    expect(onDeny).toHaveBeenCalled();
  });

  it("works with three options", async () => {
    const onAlways = vi.fn();
    const { stdin } = render(
      <ConfirmPrompt
        title="Test?"
        options={[
          { label: "Yes", shortcut: "y", color: "green", onSelect: vi.fn() },
          { label: "Always", shortcut: "a", color: "cyan", onSelect: onAlways },
          { label: "No", shortcut: "n", color: "red", onSelect: vi.fn() },
        ]}
      />,
    );

    stdin.write("a");
    await flush();
    expect(onAlways).toHaveBeenCalled();
  });
});
