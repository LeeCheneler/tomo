import { render } from "ink-testing-library";
import { afterEach, describe, expect, it } from "vitest";
import { ChatInput } from "./chat-input";

const COLUMNS = 40;

/** Override process.stdout.columns for test predictability. */
function setColumns(width: number | undefined) {
  Object.defineProperty(process.stdout, "columns", {
    value: width,
    writable: true,
    configurable: true,
  });
}

describe("ChatInput", () => {
  afterEach(() => {
    // Restore to undefined so tests don't leak.
    setColumns(undefined);
  });

  /** Renders ChatInput with sensible defaults and a fixed terminal width. */
  function renderInput(
    overrides: Partial<{
      value: string;
      statusText: string;
    }> = {},
  ) {
    setColumns(COLUMNS);

    return render(
      <ChatInput
        value={overrides.value ?? ""}
        onChange={() => {}}
        onSubmit={() => {}}
        statusText={overrides.statusText ?? ""}
      />,
    );
  }

  describe("layout", () => {
    it("renders a top border at full terminal width", () => {
      const { lastFrame } = renderInput();
      const frame = lastFrame() ?? "";
      const lines = frame.split("\n");
      // paddingTop={1} adds an empty line before the border.
      expect(lines[1]).toBe("─".repeat(COLUMNS));
    });

    it("renders the input value with a prompt marker", () => {
      const { lastFrame } = renderInput({ value: "hello world" });
      expect(lastFrame()).toContain("❯ hello world");
    });

    it("renders the prompt marker when value is empty", () => {
      const { lastFrame } = renderInput({ value: "" });
      // Ink trims trailing whitespace, so we assert on the marker alone.
      expect(lastFrame()).toContain("❯");
    });

    it("falls back to 80 columns when stdout.columns is undefined", () => {
      setColumns(undefined);

      const { lastFrame } = render(
        <ChatInput
          value=""
          onChange={() => {}}
          onSubmit={() => {}}
          statusText=""
        />,
      );

      const frame = lastFrame() ?? "";
      const lines = frame.split("\n");
      expect(lines[1]).toBe("─".repeat(80));
    });
  });

  describe("status bar", () => {
    it("renders a bottom border at full terminal width with no status", () => {
      const { lastFrame } = renderInput({ statusText: "" });
      const frame = lastFrame() ?? "";
      const lines = frame.split("\n");
      const bottomBorder = lines[lines.length - 1];
      expect(bottomBorder).toBe("─".repeat(COLUMNS));
    });

    it("renders status text right-aligned on the bottom border", () => {
      const status = "1% context";
      const { lastFrame } = renderInput({ statusText: status });
      const frame = lastFrame() ?? "";
      const lines = frame.split("\n");
      const bottomBorder = lines[lines.length - 1];

      const trailingSuffix = "──";
      const expectedSuffix = `${status}${trailingSuffix}`;
      expect(bottomBorder).toContain(expectedSuffix);
      expect(bottomBorder).toHaveLength(COLUMNS);

      const leadingLength = COLUMNS - status.length - 2;
      const leading = "─".repeat(leadingLength);
      expect(bottomBorder).toBe(`${leading}${status}${trailingSuffix}`);
    });
  });
});
