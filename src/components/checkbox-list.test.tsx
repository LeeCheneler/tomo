import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { type CheckboxItem, CheckboxList } from "./checkbox-list";

describe("CheckboxList", () => {
  const items: CheckboxItem[] = [
    {
      key: "a",
      label: "Read File",
      description: "Read files in cwd",
      checked: true,
    },
    {
      key: "b",
      label: "Write File",
      description: "Write files in cwd",
      checked: false,
    },
  ];

  it("renders labels and descriptions", () => {
    const { lastFrame } = render(<CheckboxList items={items} cursor={0} />);
    const output = lastFrame();
    expect(output).toContain("Read File");
    expect(output).toContain("Write File");
    expect(output).toContain("Read files in cwd");
    expect(output).toContain("Write files in cwd");
  });

  it("shows green tick for checked items", () => {
    const { lastFrame } = render(<CheckboxList items={items} cursor={-1} />);
    const output = lastFrame() ?? "";
    const readLine = output.split("\n").find((l) => l.includes("Read File"));
    expect(readLine).toContain("[✔]");
    const writeLine = output.split("\n").find((l) => l.includes("Write File"));
    expect(writeLine).toContain("[ ]");
  });

  it("shows cursor indicator on selected row", () => {
    const { lastFrame } = render(<CheckboxList items={items} cursor={1} />);
    const output = lastFrame() ?? "";
    const lines = output.split("\n");
    const readLine = lines.find((l) => l.includes("Read File"));
    const writeLine = lines.find((l) => l.includes("Write File"));
    expect(readLine).not.toContain("❯");
    expect(writeLine).toContain("❯");
  });

  it("shows warning below item", () => {
    const warningItems: CheckboxItem[] = [
      {
        key: "a",
        label: "Web Search",
        checked: true,
        warning: "Requires API key",
      },
    ];
    const { lastFrame } = render(
      <CheckboxList items={warningItems} cursor={0} />,
    );
    expect(lastFrame()).toContain("Requires API key");
  });

  it("renders without description", () => {
    const noDescItems: CheckboxItem[] = [
      { key: "a", label: "Glob", checked: true },
    ];
    const { lastFrame } = render(
      <CheckboxList items={noDescItems} cursor={0} />,
    );
    expect(lastFrame()).toContain("Glob");
  });
});
