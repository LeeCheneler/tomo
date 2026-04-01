import { Text } from "ink";
import { flushInkFrames, renderInk } from "../test-utils/ink";
import { describe, expect, it } from "vitest";
import { useHistory } from "./use-history";

/** Captures the hook API and renders entries for assertion. */
let api: ReturnType<typeof useHistory>;
function Harness() {
  api = useHistory();
  return <Text>{api.entries.join(",")}</Text>;
}

describe("useHistory", () => {
  it("starts with an empty entries array", () => {
    const { lastFrame } = renderInk(<Harness />);
    expect(lastFrame()).toBe("");
    expect(api.entries).toEqual([]);
  });

  it("appends an entry on push", async () => {
    const { lastFrame } = renderInk(<Harness />);
    api.push("hello");
    await flushInkFrames();
    expect(lastFrame()).toBe("hello");
    expect(api.entries).toEqual(["hello"]);
  });

  it("accumulates multiple entries in order", async () => {
    const { lastFrame } = renderInk(<Harness />);
    api.push("first");
    api.push("second");
    api.push("third");
    await flushInkFrames();
    expect(lastFrame()).toBe("first,second,third");
    expect(api.entries).toEqual(["first", "second", "third"]);
  });
});
