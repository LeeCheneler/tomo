import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import { CommandConfirm } from "./command-confirm";

const flush = () => new Promise((r) => setTimeout(r, 50));

function renderConfirm(overrides?: {
  isDestructive?: boolean;
  onApprove?: () => void;
  onApproveAlways?: () => void;
  onDeny?: () => void;
}) {
  const onApprove = overrides?.onApprove ?? vi.fn();
  const onApproveAlways = overrides?.onApproveAlways ?? vi.fn();
  const onDeny = overrides?.onDeny ?? vi.fn();
  const result = render(
    <CommandConfirm
      command="git status"
      isDestructive={overrides?.isDestructive}
      onApprove={onApprove}
      onApproveAlways={onApproveAlways}
      onDeny={onDeny}
    />,
  );
  return { ...result, onApprove, onApproveAlways, onDeny };
}

describe("CommandConfirm", () => {
  it("renders the command and all three options", () => {
    const { lastFrame } = renderConfirm();
    const output = lastFrame();
    expect(output).toContain("Run this command?");
    expect(output).toContain("git status");
    expect(output).toContain("Approve (y)");
    expect(output).toContain("Approve Always (a)");
    expect(output).toContain("Deny (n)");
  });

  it("does not show destructive warning by default", () => {
    const { lastFrame } = renderConfirm();
    expect(lastFrame()).not.toContain("Destructive");
  });

  it("shows destructive warning when isDestructive is true", () => {
    const { lastFrame } = renderConfirm({ isDestructive: true });
    expect(lastFrame()).toContain("Destructive command detected");
  });

  it("calls onApprove on Enter when cursor is on Approve", async () => {
    const { stdin, onApprove } = renderConfirm();
    stdin.write("\r");
    await flush();
    expect(onApprove).toHaveBeenCalled();
  });

  it("calls onApproveAlways on Enter when cursor is on Approve Always", async () => {
    const { stdin, onApproveAlways } = renderConfirm();
    stdin.write("\x1B[B"); // down to Approve Always
    await flush();
    stdin.write("\r");
    await flush();
    expect(onApproveAlways).toHaveBeenCalled();
  });

  it("calls onDeny on Enter when cursor is on Deny", async () => {
    const { stdin, onDeny } = renderConfirm();
    stdin.write("\x1B[B"); // down to Approve Always
    await flush();
    stdin.write("\x1B[B"); // down to Deny
    await flush();
    stdin.write("\r");
    await flush();
    expect(onDeny).toHaveBeenCalled();
  });

  it("calls onApprove on y shortcut", async () => {
    const { stdin, onApprove } = renderConfirm();
    stdin.write("y");
    await flush();
    expect(onApprove).toHaveBeenCalled();
  });

  it("calls onApproveAlways on a shortcut", async () => {
    const { stdin, onApproveAlways } = renderConfirm();
    stdin.write("a");
    await flush();
    expect(onApproveAlways).toHaveBeenCalled();
  });

  it("calls onDeny on n shortcut", async () => {
    const { stdin, onDeny } = renderConfirm();
    stdin.write("n");
    await flush();
    expect(onDeny).toHaveBeenCalled();
  });

  it("calls onDeny on Escape", async () => {
    const { stdin, onDeny } = renderConfirm();
    stdin.write("\x1B");
    await flush();
    expect(onDeny).toHaveBeenCalled();
  });

  it("cursor wraps around with arrow keys", async () => {
    const { stdin, onDeny } = renderConfirm();
    // Down 3 times wraps back to Approve, then down twice to Deny
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\x1B[B"); // wraps to 0
    await flush();
    stdin.write("\x1B[B"); // 1
    await flush();
    stdin.write("\x1B[B"); // 2 = Deny
    await flush();
    stdin.write("\r");
    await flush();
    expect(onDeny).toHaveBeenCalled();
  });
});
