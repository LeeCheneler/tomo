import { renderInk } from "../../test-utils/ink";
import { Text } from "ink";
import { describe, expect, it } from "vitest";
import { Indent } from "./indent";

describe("Indent", () => {
  it("renders children with default indent level of 1 (2 chars)", () => {
    const { lastFrame } = renderInk(
      <Indent>
        <Text>hello</Text>
      </Indent>,
    );
    expect(lastFrame()).toBe("  hello");
  });

  it("renders children with custom indent level", () => {
    const { lastFrame } = renderInk(
      <Indent level={2}>
        <Text>hello</Text>
      </Indent>,
    );
    expect(lastFrame()).toBe("    hello");
  });

  it("renders children with zero indent", () => {
    const { lastFrame } = renderInk(
      <Indent level={0}>
        <Text>hello</Text>
      </Indent>,
    );
    expect(lastFrame()).toBe("hello");
  });
});
