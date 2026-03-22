import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import { GrantSelector } from "./grant-selector";

const flush = () => new Promise((r) => setTimeout(r, 50));

const defaults = {
  read_file: true,
  write_file: false,
  edit_file: false,
};

describe("GrantSelector", () => {
  it("renders all tools with their current permissions", () => {
    const { lastFrame } = render(
      <GrantSelector
        currentPermissions={defaults}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const output = lastFrame();
    expect(output).toContain("Tool Permissions");
    expect(output).toContain("read_file");
    expect(output).toContain("write_file");
    expect(output).toContain("edit_file");
    expect(output).toContain("run_command");
    expect(output).toContain("always prompts");
  });

  it("shows enabled permissions as [x] and disabled as [ ]", () => {
    const { lastFrame } = render(
      <GrantSelector
        currentPermissions={defaults}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const output = lastFrame() ?? "";
    // read_file is enabled
    const readLine = output.split("\n").find((l) => l.includes("read_file"));
    expect(readLine).toContain("[✔]");
    // write_file is disabled
    const writeLine = output.split("\n").find((l) => l.includes("write_file"));
    expect(writeLine).toContain("[ ]");
  });

  it("toggles permission with Space", async () => {
    const onSave = vi.fn();
    const { stdin } = render(
      <GrantSelector
        currentPermissions={defaults}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    // Move down to write_file (index 1)
    stdin.write("\x1B[B");
    await flush();
    // Toggle with space
    stdin.write(" ");
    await flush();
    // Save with Esc
    stdin.write("\x1B");
    await flush();

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ write_file: true }),
    );
  });

  it("toggles permission with Enter", async () => {
    const onSave = vi.fn();
    const { stdin } = render(
      <GrantSelector
        currentPermissions={defaults}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    // Move down to edit_file (index 2)
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\x1B[B");
    await flush();
    // Toggle with Enter
    stdin.write("\r");
    await flush();
    // Save
    stdin.write("\x1B");
    await flush();

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ edit_file: true }),
    );
  });

  it("does not toggle run_command", async () => {
    const onSave = vi.fn();
    const { stdin } = render(
      <GrantSelector
        currentPermissions={defaults}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    // Move to run_command (index 3)
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\x1B[B");
    await flush();
    // Try to toggle
    stdin.write(" ");
    await flush();
    // Save
    stdin.write("\x1B");
    await flush();

    const saved = onSave.mock.calls[0][0];
    expect(saved.run_command).toBeUndefined();
  });

  it("calls onCancel on q", async () => {
    const onCancel = vi.fn();
    const { stdin } = render(
      <GrantSelector
        currentPermissions={defaults}
        onSave={vi.fn()}
        onCancel={onCancel}
      />,
    );

    stdin.write("q");
    await flush();

    expect(onCancel).toHaveBeenCalled();
  });

  it("saves on Esc", async () => {
    const onSave = vi.fn();
    const { stdin } = render(
      <GrantSelector
        currentPermissions={defaults}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    stdin.write("\x1B");
    await flush();

    expect(onSave).toHaveBeenCalledWith(defaults);
  });
});
