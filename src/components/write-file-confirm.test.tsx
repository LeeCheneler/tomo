import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import { WriteFileConfirm } from "./write-file-confirm";

const flush = () => new Promise((r) => setTimeout(r, 50));

describe("WriteFileConfirm", () => {
  it("renders the file path, status, and diff", () => {
    const { lastFrame } = render(
      <WriteFileConfirm
        filePath="/tmp/test.txt"
        isNewFile={true}
        diffPreview="+ hello world"
        onApprove={vi.fn()}
        onDeny={vi.fn()}
      />,
    );

    const output = lastFrame();
    expect(output).toContain("Write to file?");
    expect(output).toContain("/tmp/test.txt");
    expect(output).toContain("new file");
    expect(output).toContain("+ hello world");
    expect(output).toContain("Approve (y)");
    expect(output).toContain("Deny (n)");
  });

  it("shows modified status for existing files", () => {
    const { lastFrame } = render(
      <WriteFileConfirm
        filePath="/tmp/test.txt"
        isNewFile={false}
        diffPreview="- old\n+ new"
        onApprove={vi.fn()}
        onDeny={vi.fn()}
      />,
    );

    expect(lastFrame()).toContain("modified");
  });

  it("calls onApprove on y shortcut", async () => {
    const onApprove = vi.fn();
    const { stdin } = render(
      <WriteFileConfirm
        filePath="/tmp/test.txt"
        isNewFile={true}
        diffPreview=""
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
      <WriteFileConfirm
        filePath="/tmp/test.txt"
        isNewFile={true}
        diffPreview=""
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
      <WriteFileConfirm
        filePath="/tmp/test.txt"
        isNewFile={true}
        diffPreview=""
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
      <WriteFileConfirm
        filePath="/tmp/test.txt"
        isNewFile={true}
        diffPreview=""
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
      <WriteFileConfirm
        filePath="/tmp/test.txt"
        isNewFile={true}
        diffPreview=""
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
});
