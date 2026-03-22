import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import { ToolSelector } from "./tool-selector";

const flush = () => new Promise((r) => setTimeout(r, 50));

const toolNames = ["read_file", "write_file", "glob", "grep"];
const defaults: Record<string, boolean> = {
  read_file: true,
  write_file: true,
  glob: true,
  grep: true,
};

describe("ToolSelector", () => {
  it("renders all tools with their current availability", () => {
    const { lastFrame } = render(
      <ToolSelector
        tools={toolNames}
        currentAvailability={defaults}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const output = lastFrame();
    expect(output).toContain("Tool Availability");
    expect(output).toContain("read_file");
    expect(output).toContain("write_file");
    expect(output).toContain("glob");
    expect(output).toContain("grep");
  });

  it("shows enabled tools as [✔] and disabled as [ ]", () => {
    const availability = { ...defaults, grep: false };
    const { lastFrame } = render(
      <ToolSelector
        tools={toolNames}
        currentAvailability={availability}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const output = lastFrame() ?? "";
    const grepLine = output.split("\n").find((l) => l.includes("grep"));
    expect(grepLine).toContain("[ ]");
    const readLine = output.split("\n").find((l) => l.includes("read_file"));
    expect(readLine).toContain("[✔]");
  });

  it("toggles tool with Space", async () => {
    const onSave = vi.fn();
    const { stdin } = render(
      <ToolSelector
        tools={toolNames}
        currentAvailability={defaults}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    // Toggle first tool (read_file) off
    stdin.write(" ");
    await flush();
    // Save with Esc
    stdin.write("\x1B");
    await flush();

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ read_file: false }),
    );
  });

  it("toggles tool with Enter", async () => {
    const onSave = vi.fn();
    const { stdin } = render(
      <ToolSelector
        tools={toolNames}
        currentAvailability={defaults}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    // Move to write_file (index 1)
    stdin.write("\x1B[B");
    await flush();
    // Toggle with Enter
    stdin.write("\r");
    await flush();
    // Save
    stdin.write("\x1B");
    await flush();

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ write_file: false }),
    );
  });

  it("navigates with arrow keys and wraps around", async () => {
    const onSave = vi.fn();
    const { stdin } = render(
      <ToolSelector
        tools={toolNames}
        currentAvailability={defaults}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    // Move up from first item should wrap to last
    stdin.write("\x1B[A");
    await flush();
    // Toggle last tool (grep)
    stdin.write(" ");
    await flush();
    // Save
    stdin.write("\x1B");
    await flush();

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ grep: false }),
    );
  });

  it("calls onCancel on q", async () => {
    const onCancel = vi.fn();
    const { stdin } = render(
      <ToolSelector
        tools={toolNames}
        currentAvailability={defaults}
        onSave={vi.fn()}
        onCancel={onCancel}
      />,
    );

    stdin.write("q");
    await flush();

    expect(onCancel).toHaveBeenCalled();
  });

  it("saves unchanged state on Esc", async () => {
    const onSave = vi.fn();
    const { stdin } = render(
      <ToolSelector
        tools={toolNames}
        currentAvailability={defaults}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );

    stdin.write("\x1B");
    await flush();

    expect(onSave).toHaveBeenCalledWith(defaults);
  });
});
