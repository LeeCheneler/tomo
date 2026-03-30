import { render } from "ink-testing-library";
import { Box, Text } from "ink";
import { describe, expect, it } from "vitest";
import { BlankLine } from "./blank-line";

describe("BlankLine", () => {
  it("renders a blank line between content", () => {
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
    expect(lines.length).toBe(3);
  });
});
