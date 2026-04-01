import { Text, useInput } from "ink";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { keys } from "./keys";
import { renderInk } from "./ink";

describe("renderInk", () => {
  it("returns lastFrame from the rendered component", () => {
    const { lastFrame } = renderInk(<Text>hello</Text>);
    expect(lastFrame()).toContain("hello");
  });

  it("stdin.write returns a promise", () => {
    const { stdin } = renderInk(<Text>test</Text>);
    const result = stdin.write("x");
    expect(result).toBeInstanceOf(Promise);
  });

  it("stdin.write auto-flushes so escape key state is visible", async () => {
    /** Test component that shows escape state. */
    function EscapeTracker() {
      const [escaped, setEscaped] = useState(false);
      useInput((_input, key) => {
        if (key.escape) {
          setEscaped(true);
        }
      });
      return <Text>{escaped ? "escaped" : "waiting"}</Text>;
    }

    const { stdin, lastFrame } = renderInk(<EscapeTracker />);
    expect(lastFrame()).toContain("waiting");
    await stdin.write(keys.escape);
    expect(lastFrame()).toContain("escaped");
  });
});
