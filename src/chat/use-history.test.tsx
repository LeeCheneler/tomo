import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import { useHistory } from "./use-history";

/** Captures the hook return value for assertion. */
function renderHistory() {
  let result: ReturnType<typeof useHistory>;

  /** Captures the hook return value on each render. */
  function Harness() {
    result = useHistory();
    return null;
  }

  render(<Harness />);

  return {
    get current() {
      return result!;
    },
  };
}

describe("useHistory", () => {
  it("starts with an empty entries array", () => {
    const hook = renderHistory();
    expect(hook.current.entries).toEqual([]);
  });

  it("appends an entry on push", () => {
    const hook = renderHistory();
    hook.current.push("hello");
    expect(hook.current.entries).toEqual(["hello"]);
  });

  it("accumulates multiple entries in order", () => {
    const hook = renderHistory();
    hook.current.push("first");
    hook.current.push("second");
    hook.current.push("third");
    expect(hook.current.entries).toEqual(["first", "second", "third"]);
  });
});
