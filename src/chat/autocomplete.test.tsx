import { describe, expect, it } from "vitest";
import { renderInk } from "../test-utils/ink";
import { flushInkFrames } from "../test-utils/ink";
import {
  AutocompleteList,
  filterAutocompleteItems,
  useAutocompleteNavigation,
} from "./autocomplete";
import type { AutocompleteItem, AutocompleteNavigation } from "./autocomplete";
import { Text } from "ink";

/** Test items covering more than MAX_VISIBLE (5). */
const items: AutocompleteItem[] = [
  { name: "ping", description: "Responds with pong" },
  { name: "settings", description: "Edit settings" },
  { name: "help", description: "Show help" },
  { name: "history", description: "Show history" },
  { name: "clear", description: "Clear chat" },
  { name: "context", description: "Show context" },
];

describe("filterAutocompleteItems", () => {
  it("returns all items sorted alphabetically for empty filter", () => {
    const result = filterAutocompleteItems(items, "");
    expect(result.map((i) => i.name)).toEqual([
      "clear",
      "context",
      "help",
      "history",
      "ping",
      "settings",
    ]);
  });

  it("filters using includes matching", () => {
    const result = filterAutocompleteItems(items, "set");
    expect(result.map((i) => i.name)).toEqual(["settings"]);
  });

  it("matches anywhere in the command name", () => {
    const result = filterAutocompleteItems(items, "ing");
    expect(result.map((i) => i.name)).toEqual(["ping", "settings"]);
  });

  it("is case insensitive", () => {
    const result = filterAutocompleteItems(items, "PING");
    expect(result.map((i) => i.name)).toEqual(["ping"]);
  });

  it("returns empty array when no items match", () => {
    expect(filterAutocompleteItems(items, "zzz")).toEqual([]);
  });
});

describe("useAutocompleteNavigation", () => {
  /** Captures the hook return value for assertion. */
  let nav: AutocompleteNavigation;
  function Harness(props: {
    items: readonly AutocompleteItem[];
    filter: string;
    isActive: boolean;
  }) {
    nav = useAutocompleteNavigation(props.items, props.filter, props.isActive);
    return <Text>{nav.filtered.map((i) => i.name).join(",")}</Text>;
  }

  it("starts with selectedIndex 0 and windowStart 0", () => {
    renderInk(<Harness items={items} filter="" isActive={true} />);
    expect(nav.selectedIndex).toBe(0);
    expect(nav.windowStart).toBe(0);
  });

  it("moveDown advances selection and loops", async () => {
    renderInk(<Harness items={items} filter="" isActive={true} />);
    // 6 items. Down 6 times should loop back to 0.
    for (let i = 0; i < 6; i++) {
      nav.moveDown();
    }
    await flushInkFrames();
    expect(nav.selectedIndex).toBe(0);
  });

  it("moveUp loops from first to last", async () => {
    renderInk(<Harness items={items} filter="" isActive={true} />);
    nav.moveUp();
    await flushInkFrames();
    expect(nav.selectedIndex).toBe(5);
  });

  it("slides window when selection hits bottom edge", async () => {
    renderInk(<Harness items={items} filter="" isActive={true} />);
    // Move down 5 times: index 5, window should slide.
    for (let i = 0; i < 5; i++) {
      nav.moveDown();
    }
    await flushInkFrames();
    expect(nav.selectedIndex).toBe(5);
    expect(nav.windowStart).toBe(1);
  });

  it("slides window back to start when navigating up past it", async () => {
    renderInk(<Harness items={items} filter="" isActive={true} />);
    // Go to index 5 (window=1), then navigate back to index 0.
    for (let i = 0; i < 5; i++) {
      nav.moveDown();
    }
    await flushInkFrames();
    expect(nav.windowStart).toBe(1);
    // Navigate back up to index 0.
    for (let i = 0; i < 5; i++) {
      nav.moveUp();
    }
    await flushInkFrames();
    expect(nav.selectedIndex).toBe(0);
    expect(nav.windowStart).toBe(0);
  });

  it("select returns the currently selected item", () => {
    renderInk(<Harness items={items} filter="" isActive={true} />);
    const selected = nav.select();
    // First alphabetically is clear.
    expect(selected?.name).toBe("clear");
  });

  it("reset sets selectedIndex and windowStart to 0", async () => {
    renderInk(<Harness items={items} filter="" isActive={true} />);
    nav.moveDown();
    nav.moveDown();
    await flushInkFrames();
    nav.reset();
    await flushInkFrames();
    expect(nav.selectedIndex).toBe(0);
    expect(nav.windowStart).toBe(0);
  });

  it("does nothing on moveUp/moveDown when filtered is empty", async () => {
    renderInk(<Harness items={items} filter="zzz" isActive={true} />);
    nav.moveDown();
    nav.moveUp();
    await flushInkFrames();
    expect(nav.selectedIndex).toBe(0);
  });
});

describe("AutocompleteList", () => {
  /** Creates a navigation object for rendering tests. */
  let nav: AutocompleteNavigation;
  function HarnessWithList(props: {
    items: readonly AutocompleteItem[];
    filter: string;
  }) {
    nav = useAutocompleteNavigation(props.items, props.filter, true);
    return <AutocompleteList autocomplete={nav} />;
  }

  it("renders nothing when no items match", () => {
    const { lastFrame } = renderInk(
      <HarnessWithList items={items} filter="zzz" />,
    );
    expect(lastFrame()).toBe("");
  });

  it("shows up to 5 items", () => {
    const { lastFrame } = renderInk(
      <HarnessWithList items={items} filter="" />,
    );
    const frame = lastFrame() ?? "";
    const commandLines = frame.split("\n").filter((l) => l.includes("/"));
    expect(commandLines).toHaveLength(5);
  });

  it("shows command descriptions", () => {
    const { lastFrame } = renderInk(
      <HarnessWithList items={items} filter="ping" />,
    );
    expect(lastFrame()).toContain("Responds with pong");
  });

  it("highlights the selected item", async () => {
    const { lastFrame } = renderInk(
      <HarnessWithList items={items} filter="" />,
    );
    nav.moveDown();
    await flushInkFrames();
    const frame = lastFrame() ?? "";
    // Both clear and context should be visible.
    expect(frame).toContain("clear");
    expect(frame).toContain("context");
  });

  it("slides window to keep selected item visible", async () => {
    const { lastFrame } = renderInk(
      <HarnessWithList items={items} filter="" />,
    );
    // Move to index 5 (settings).
    for (let i = 0; i < 5; i++) {
      nav.moveDown();
    }
    await flushInkFrames();
    const frame = lastFrame() ?? "";
    expect(frame).toContain("settings");
    expect(frame).not.toContain("clear");
  });
});
