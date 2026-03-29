import { Text } from "ink";
import { render } from "ink-testing-library";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
  type AutocompleteProvider,
  type AutocompleteState,
  useAutocomplete,
} from "./use-autocomplete";

const flush = () => new Promise((r) => setTimeout(r, 50));

const testItems = [
  { name: "context", description: "Show context" },
  { name: "grant", description: "Grant permissions" },
  { name: "help", description: "Show help" },
  { name: "history", description: "Show history" },
  { name: "model", description: "Switch model" },
  { name: "new", description: "New session" },
  { name: "session", description: "Manage sessions" },
  { name: "status", description: "Show status" },
];

const providers: AutocompleteProvider[] = [
  { prefix: "/", items: () => testItems },
];

interface HarnessControls {
  state: AutocompleteState | null;
  setValue: (v: string) => void;
}

function Harness({
  providers,
  controls,
}: {
  providers: AutocompleteProvider[];
  controls: HarnessControls;
}) {
  const [value, setValue] = useState("");
  const state = useAutocomplete(providers, value);
  controls.state = state;
  controls.setValue = (v: string) => {
    setValue(v);
  };

  return <Text>{JSON.stringify({ active: state.active })}</Text>;
}

function setup(providerList: AutocompleteProvider[] = providers) {
  const controls: HarnessControls = {
    state: null,
    setValue: () => {},
  };
  render(<Harness providers={providerList} controls={controls} />);
  return controls;
}

describe("useAutocomplete", () => {
  it("is inactive for non-prefixed input", async () => {
    const c = setup();
    c.setValue("hello");
    await flush();
    expect(c.state?.active).toBe(false);
    expect(c.state?.visibleEntries).toHaveLength(0);
  });

  it("activates when input starts with the prefix", async () => {
    const c = setup();
    c.setValue("/");
    await flush();
    expect(c.state?.active).toBe(true);
    expect(c.state?.prefix).toBe("/");
  });

  it("shows matches at the top of visible entries", async () => {
    const c = setup();
    c.setValue("/h");
    await flush();
    const names = c.state?.visibleEntries.map((e) => e.name) ?? [];
    // "help" and "history" match, then non-matches follow
    expect(names[0]).toBe("help");
    expect(names[1]).toBe("history");
    // Non-matches fill the rest of the window
    expect(c.state?.visibleEntries).toHaveLength(5);
    expect(c.state?.visibleEntries[0].matched).toBe(true);
    expect(c.state?.visibleEntries[1].matched).toBe(true);
    expect(c.state?.visibleEntries[2].matched).toBe(false);
  });

  it("shows all items as matches when only prefix is typed", async () => {
    const c = setup();
    c.setValue("/");
    await flush();
    // All 8 items match, window shows first 5
    expect(c.state?.visibleEntries).toHaveLength(5);
    expect(c.state?.visibleEntries.every((e) => e.matched)).toBe(true);
  });

  it("matches items containing the partial anywhere, sorted by index", async () => {
    const includesProviders: AutocompleteProvider[] = [
      {
        prefix: "/",
        items: () => [
          { name: "dev:pr", description: "Dev PR" },
          { name: "pr", description: "Create PR" },
          { name: "approve", description: "Approve PR" },
          { name: "other", description: "Other" },
        ],
      },
    ];
    const c = setup(includesProviders);
    c.setValue("/pr");
    await flush();

    const matched = c.state?.visibleEntries.filter((e) => e.matched) ?? [];
    // "pr" matches at index 0, "dev:pr" at index 4, "approve" at index 2
    expect(matched).toHaveLength(3);
    expect(matched[0].name).toBe("pr");
    expect(matched[1].name).toBe("approve");
    expect(matched[2].name).toBe("dev:pr");
  });

  it("shows no entries when nothing matches", async () => {
    const c = setup();
    c.setValue("/zzz");
    await flush();
    expect(c.state?.active).toBe(true);
    expect(c.state?.visibleEntries).toHaveLength(0);
    expect(c.state?.submitValue).toBeNull();
  });

  it("returns submitValue with prefix + selected name", async () => {
    const c = setup();
    c.setValue("/he");
    await flush();
    expect(c.state?.submitValue).toBe("/help");
  });

  it("deactivates when input contains a space", async () => {
    const c = setup();
    c.setValue("/help ");
    await flush();
    expect(c.state?.active).toBe(false);
  });

  it("moveDown cycles through all entries", async () => {
    const c = setup();
    c.setValue("/h");
    await flush();
    expect(c.state?.visibleSelectedIndex).toBe(0);
    expect(c.state?.submitValue).toBe("/help");

    c.state?.moveDown();
    await flush();
    expect(c.state?.visibleSelectedIndex).toBe(1);
    expect(c.state?.submitValue).toBe("/history");

    // Navigate into non-matches
    c.state?.moveDown();
    await flush();
    expect(c.state?.submitValue).toBe("/context");
  });

  it("moveUp wraps from first to last", async () => {
    const c = setup();
    c.setValue("/he");
    await flush();
    expect(c.state?.visibleSelectedIndex).toBe(0);

    c.state?.moveUp();
    await flush();
    // Wraps to last entry (8 total: 2 matches + 6 non-matches)
    expect(c.state?.submitValue).toBe("/status");
  });

  it("moveDown wraps from last to first", async () => {
    setup();
    // Use a small set so we can reach the end easily
    const smallProviders: AutocompleteProvider[] = [
      {
        prefix: "/",
        items: () => [
          { name: "aa", description: "A" },
          { name: "ab", description: "B" },
        ],
      },
    ];
    const c2 = setup(smallProviders);
    c2.setValue("/a");
    await flush();
    // Both match, navigate to last then wrap
    c2.state?.moveDown();
    await flush();
    expect(c2.state?.visibleSelectedIndex).toBe(1);
    c2.state?.moveDown();
    await flush();
    expect(c2.state?.visibleSelectedIndex).toBe(0);
  });

  it("resets selection when value changes", async () => {
    const c = setup();
    c.setValue("/h");
    await flush();
    c.state?.moveDown();
    await flush();
    expect(c.state?.visibleSelectedIndex).toBe(1);

    c.setValue("/he");
    await flush();
    expect(c.state?.visibleSelectedIndex).toBe(0);
  });

  it("scrolls the window when navigating past visible entries", async () => {
    const c = setup();
    c.setValue("/");
    await flush();
    // 8 items total, window shows 5. Navigate down to item 5 (index 4 is last visible)
    const names = () => c.state?.visibleEntries.map((e) => e.name) ?? [];
    expect(names()[0]).toBe("context");

    // Navigate to index 5 (6th item, should scroll)
    for (let i = 0; i < 5; i++) {
      c.state?.moveDown();
      await flush();
    }
    // Window should have scrolled to keep selection visible
    expect(c.state?.visibleSelectedIndex).toBeGreaterThanOrEqual(0);
    expect(c.state?.visibleSelectedIndex).toBeLessThan(5);
    expect(names()).toContain("new");
  });

  it("scrolls up when navigating above visible window", async () => {
    const c = setup();
    c.setValue("/");
    await flush();
    // Navigate down past the window
    for (let i = 0; i < 6; i++) {
      c.state?.moveDown();
      await flush();
    }
    // Now navigate back up
    for (let i = 0; i < 6; i++) {
      c.state?.moveUp();
      await flush();
    }
    // Should be back at the top
    expect(c.state?.visibleSelectedIndex).toBe(0);
    expect(c.state?.visibleEntries[0].name).toBe("context");
  });

  it("matches the longest prefix first", async () => {
    const skillItems = [{ name: "review", description: "Review code" }];
    const multiProviders: AutocompleteProvider[] = [
      { prefix: "/", items: () => testItems },
      { prefix: "//", items: () => skillItems },
    ];

    const c = setup(multiProviders);

    c.setValue("//r");
    await flush();
    expect(c.state?.active).toBe(true);
    expect(c.state?.prefix).toBe("//");
    expect(c.state?.visibleEntries[0].name).toBe("review");
    expect(c.state?.submitValue).toBe("//review");
  });

  it("falls back to shorter prefix when longer does not match", async () => {
    const skillItems = [{ name: "review", description: "Review code" }];
    const multiProviders: AutocompleteProvider[] = [
      { prefix: "/", items: () => testItems },
      { prefix: "//", items: () => skillItems },
    ];

    const c = setup(multiProviders);

    c.setValue("/h");
    await flush();
    expect(c.state?.prefix).toBe("/");
    expect(c.state?.visibleEntries[0].name).toBe("help");
  });
});
