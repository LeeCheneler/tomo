import { render } from "ink-testing-library";
import { Text } from "ink";
import { describe, expect, it } from "vitest";
import { Indent } from "./indent";

describe("Indent", () => {
  it("renders children with default indent level of 1 (2 chars)", () => {
    const { lastFrame } = render(
      <Indent>
        <Text>hello</Text>
      </Indent>,
    );
    expect(lastFrame()).toBe("  hello");
  });

  it("renders children with custom indent level", () => {
    const { lastFrame } = render(
      <Indent level={2}>
        <Text>hello</Text>
      </Indent>,
    );
    expect(lastFrame()).toBe("    hello");
  });

  it("renders children with zero indent", () => {
    const { lastFrame } = render(
      <Indent level={0}>
        <Text>hello</Text>
      </Indent>,
    );
    expect(lastFrame()).toBe("hello");
  });
});
