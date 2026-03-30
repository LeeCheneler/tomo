import { render } from "ink-testing-library";
import { Box, Text } from "ink";
import { describe, expect, it } from "vitest";
import { BlankLine } from "./blank-line";

describe("BlankLine", () => {
  it("renders a single blank line by default", () => {
    const { lastFrame } = render(
      <Box flexDirection="column">
        <Text>above</Text>
        <BlankLine />
        <Text>below</Text>
      </Box>,
    );
    const lines = lastFrame()?.split("\n") ?? [];
    expect(lines[0]).toBe("above");
    expect(lines[lines.length - 1]).toBe("below");
    expect(lines.length).toBeGreaterThan(2);
  });

  it("renders multiple blank lines", () => {
    const { lastFrame } = render(
      <Box flexDirection="column">
        <Text>above</Text>
        <BlankLine lines={2} />
        <Text>below</Text>
      </Box>,
    );
    const lines = lastFrame()?.split("\n") ?? [];
    expect(lines[0]).toBe("above");
    expect(lines[lines.length - 1]).toBe("below");
    expect(lines.length).toBeGreaterThanOrEqual(4);
  });
});
