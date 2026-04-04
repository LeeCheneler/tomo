import { afterEach, describe, expect, it } from "vitest";
import { renderInk } from "../test-utils/ink";
import { mockConfig } from "../test-utils/mock-config";
import type { MockFsState } from "../test-utils/mock-fs";
import type { Config } from "./schema";
import { useConfig } from "./hook";

describe("useConfig", () => {
  let fsState: MockFsState;

  afterEach(() => {
    fsState?.restore();
  });

  it("returns config loaded from disk", () => {
    fsState = mockConfig({
      global: { activeModel: "llama3", activeProvider: "my-ollama" },
    });
    let captured: Config | undefined;

    /** Captures the hook return value during render. */
    function Harness() {
      captured = useConfig();
      return null;
    }

    renderInk(<Harness />);

    expect(captured).toBeDefined();
    expect(captured?.activeModel).toBe("llama3");
    expect(captured?.activeProvider).toBe("my-ollama");
  });

  it("returns null activeModel and activeProvider by default", () => {
    fsState = mockConfig({ global: {} });
    let captured: Config | undefined;

    /** Captures the hook return value during render. */
    function Harness() {
      captured = useConfig();
      return null;
    }

    renderInk(<Harness />);

    expect(captured).toBeDefined();
    expect(captured?.activeModel ?? null).toBeNull();
    expect(captured?.activeProvider ?? null).toBeNull();
  });
});
