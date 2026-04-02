import { describe, expect, it } from "vitest";
import { renderInk } from "../test-utils/ink";
import { AutocompleteList } from "./autocomplete";
import type { AutocompleteItem } from "./autocomplete";

/** Test items covering more than MAX_VISIBLE (5). */
const items: AutocompleteItem[] = [
  { name: "ping", description: "Responds with pong" },
  { name: "settings", description: "Edit settings" },
  { name: "help", description: "Show help" },
  { name: "history", description: "Show history" },
  { name: "clear", description: "Clear chat" },
  { name: "context", description: "Show context" },
];

describe("AutocompleteList", () => {
  it("renders nothing when no items match", () => {
    const { lastFrame } = renderInk(
      <AutocompleteList items={items} filter="zzz" />,
    );
    expect(lastFrame()).toBe("");
  });

  it("shows all matching commands alphabetically for empty filter", () => {
    const { lastFrame } = renderInk(
      <AutocompleteList items={items} filter="" />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("clear");
    expect(frame).toContain("context");
    expect(frame).toContain("help");
    expect(frame).toContain("history");
    expect(frame).toContain("ping");
    expect(frame).not.toContain("settings");
  });

  it("filters using includes matching", () => {
    const { lastFrame } = renderInk(
      <AutocompleteList items={items} filter="set" />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("settings");
    expect(frame).not.toContain("ping");
  });

  it("matches anywhere in the command name", () => {
    const { lastFrame } = renderInk(
      <AutocompleteList items={items} filter="ing" />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("ping");
    expect(frame).toContain("settings");
  });

  it("is case insensitive", () => {
    const { lastFrame } = renderInk(
      <AutocompleteList items={items} filter="PING" />,
    );
    expect(lastFrame()).toContain("ping");
  });

  it("limits visible items to 5", () => {
    const { lastFrame } = renderInk(
      <AutocompleteList items={items} filter="" />,
    );
    const frame = lastFrame() ?? "";
    const commandLines = frame.split("\n").filter((l) => l.includes("/"));
    expect(commandLines).toHaveLength(5);
  });

  it("shows command descriptions", () => {
    const { lastFrame } = renderInk(
      <AutocompleteList items={items} filter="ping" />,
    );
    expect(lastFrame()).toContain("Responds with pong");
  });

  it("does not highlight any item by default", () => {
    const { lastFrame } = renderInk(
      <AutocompleteList items={items} filter="" />,
    );
    const frame = lastFrame() ?? "";
    expect(frame).toContain("/clear");
  });

  it("highlights the selected item when selectedIndex is provided", () => {
    const { lastFrame } = renderInk(
      <AutocompleteList items={items} filter="" selectedIndex={1} />,
    );
    const frame = lastFrame() ?? "";
    // Both items should be present.
    expect(frame).toContain("clear");
    expect(frame).toContain("context");
  });
});
