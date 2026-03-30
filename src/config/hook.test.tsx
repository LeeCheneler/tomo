import { render } from "ink-testing-library";
import { describe, expect, it } from "vitest";
import type { Config } from "./schema";
import { useConfig } from "./hook";

describe("useConfig", () => {
  it("returns null activeModel and activeProvider by default", () => {
    let captured: Config | undefined;

    /** Captures the hook return value during render. */
    function Harness() {
      captured = useConfig();
      return null;
    }

    render(<Harness />);

    expect(captured).toBeDefined();
    expect(captured?.activeModel).toBeNull();
    expect(captured?.activeProvider).toBeNull();
  });
});
