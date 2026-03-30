import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import { FileAccessConfirm } from "./file-access-confirm";

const flush = () => new Promise((r) => setTimeout(r, 50));

describe("FileAccessConfirm", () => {
  it("renders the action, file path, and both options", () => {
    const { lastFrame } = render(
      <FileAccessConfirm
        filePath="/tmp/test.txt"
        action="Read this file?"
        onApprove={vi.fn()}
        onDeny={vi.fn()}
      />,
    );

    const output = lastFrame();
    expect(output).toContain("Read this file?");
    expect(output).toContain("/tmp/test.txt");
    expect(output).toContain("Approve (y)");
    expect(output).toContain("Deny (n)");
  });

  it("calls onApprove on y shortcut", async () => {
    const onApprove = vi.fn();
    const { stdin } = render(
      <FileAccessConfirm
        filePath="/tmp/test.txt"
        action="Read this file?"
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
      <FileAccessConfirm
        filePath="/tmp/test.txt"
        action="Read this file?"
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
      <FileAccessConfirm
        filePath="/tmp/test.txt"
        action="Read this file?"
        onApprove={vi.fn()}
        onDeny={onDeny}
      />,
    );

    stdin.write("\x1B");
    await flush();

    expect(onDeny).toHaveBeenCalled();
  });

  it("calls onApprove on Enter when cursor is on Approve", async () => {
    const onApprove = vi.fn();
    const { stdin } = render(
      <FileAccessConfirm
        filePath="/tmp/test.txt"
        action="Read this file?"
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
      <FileAccessConfirm
        filePath="/tmp/test.txt"
        action="Read this file?"
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

  it("toggles cursor with arrow keys", async () => {
    const onDeny = vi.fn();
    const { stdin } = render(
      <FileAccessConfirm
        filePath="/tmp/test.txt"
        action="Read this file?"
        onApprove={vi.fn()}
        onDeny={onDeny}
      />,
    );

    stdin.write("\x1B[B"); // down to Deny
    await flush();
    stdin.write("\x1B[A"); // up to Approve
    await flush();
    stdin.write("\x1B[B"); // down to Deny
    await flush();
    stdin.write("\r");
    await flush();

    expect(onDeny).toHaveBeenCalled();
  });
});
