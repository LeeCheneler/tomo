import { Text } from "ink";
import { flushInkFrames, renderInk } from "../test-utils/ink";
import { describe, expect, it } from "vitest";
import { useHistory } from "./use-history";

/** Captures the hook API and renders entries for assertion. */
let api: ReturnType<typeof useHistory>;
function Harness() {
  api = useHistory();
  return <Text>{api.entries.map((e) => e.text).join(",")}</Text>;
}

describe("useHistory", () => {
  it("starts with an empty entries array", () => {
    const { lastFrame } = renderInk(<Harness />);
    expect(lastFrame()).toBe("");
    expect(api.entries).toEqual([]);
  });

  it("appends an entry on push", async () => {
    const { lastFrame } = renderInk(<Harness />);
    api.push({ text: "hello", images: [] });
    await flushInkFrames();
    expect(lastFrame()).toBe("hello");
    expect(api.entries).toHaveLength(1);
    expect(api.entries[0].text).toBe("hello");
  });

  it("accumulates multiple entries in order", async () => {
    const { lastFrame } = renderInk(<Harness />);
    api.push({ text: "first", images: [] });
    api.push({ text: "second", images: [] });
    api.push({ text: "third", images: [] });
    await flushInkFrames();
    expect(lastFrame()).toBe("first,second,third");
    expect(api.entries).toHaveLength(3);
  });

  it("preserves images in entries", async () => {
    renderInk(<Harness />);
    const img = { name: "test.png", dataUri: "data:image/png;base64,abc" };
    api.push({ text: "with image", images: [img] });
    await flushInkFrames();
    expect(api.entries[0].images).toEqual([img]);
  });
});
