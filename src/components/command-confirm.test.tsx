import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import { CommandConfirm } from "./command-confirm";

const flush = () => new Promise((r) => setTimeout(r, 50));

describe("CommandConfirm", () => {
  it("renders the command and both options", () => {
    const { lastFrame } = render(
      <CommandConfirm
        command="git status"
        onApprove={vi.fn()}
        onDeny={vi.fn()}
      />,
    );

    const output = lastFrame();
    expect(output).toContain("Run this command?");
    expect(output).toContain("git status");
    expect(output).toContain("Approve (y)");
    expect(output).toContain("Deny (n)");
  });

  it("calls onApprove on Enter when cursor is on Approve", async () => {
    const onApprove = vi.fn();
    const { stdin } = render(
      <CommandConfirm
        command="git status"
        onApprove={onApprove}
        onDeny={vi.fn()}
      />,
    );

    stdin.write("\r");
    await flush();

    expect(onApprove).toHaveBeenCalled();
  });

  it("calls onDeny on Enter when cursor is on Deny", async () => {
    const onDeny = vi.fn();
    const { stdin } = render(
      <CommandConfirm
        command="git status"
        onApprove={vi.fn()}
        onDeny={onDeny}
      />,
    );

    stdin.write("\x1B[B"); // down arrow
    await flush();
    stdin.write("\r");
    await flush();

    expect(onDeny).toHaveBeenCalled();
  });

  it("calls onApprove on y shortcut", async () => {
    const onApprove = vi.fn();
    const { stdin } = render(
      <CommandConfirm
        command="git status"
        onApprove={onApprove}
        onDeny={vi.fn()}
      />,
    );

    stdin.write("y");
    await flush();

    expect(onApprove).toHaveBeenCalled();
  });

  it("calls onDeny on n shortcut", async () => {
    const onDeny = vi.fn();
    const { stdin } = render(
      <CommandConfirm
        command="git status"
        onApprove={vi.fn()}
        onDeny={onDeny}
      />,
    );

    stdin.write("n");
    await flush();

    expect(onDeny).toHaveBeenCalled();
  });

  it("calls onDeny on Escape", async () => {
    const onDeny = vi.fn();
    const { stdin } = render(
      <CommandConfirm
        command="git status"
        onApprove={vi.fn()}
        onDeny={onDeny}
      />,
    );

    stdin.write("\x1B");
    await flush();

    expect(onDeny).toHaveBeenCalled();
  });

  it("toggles cursor with arrow keys", async () => {
    const onDeny = vi.fn();
    const { stdin } = render(
      <CommandConfirm
        command="git status"
        onApprove={vi.fn()}
        onDeny={onDeny}
      />,
    );

    // Down to Deny, up back to Approve, down to Deny again
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\x1B[A");
    await flush();
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\r");
    await flush();

    expect(onDeny).toHaveBeenCalled();
  });
});
