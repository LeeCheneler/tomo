import { Text } from "ink";
import { describe, expect, it } from "vitest";
import { renderInk } from "../test-utils/ink";
import { mockConfig } from "../test-utils/mock-config";
import type { Config } from "./schema";
import { useConfig } from "./hook";

describe("useConfig", () => {
  it("returns config loaded from disk", () => {
    let captured: Config | undefined;

    /** Captures the hook return value during render. */
    function Harness() {
      const { config } = useConfig();
      captured = config;
      return null;
    }

    renderInk(<Harness />, {
      global: { activeModel: "llama3", activeProvider: "my-ollama" },
    });

    expect(captured).toBeDefined();
    expect(captured?.activeModel).toBe("llama3");
    expect(captured?.activeProvider).toBe("my-ollama");
  });

  it("returns null activeModel and activeProvider by default", () => {
    let captured: Config | undefined;

    /** Captures the hook return value during render. */
    function Harness() {
      const { config } = useConfig();
      captured = config;
      return null;
    }

    renderInk(<Harness />);

    expect(captured).toBeDefined();
    expect(captured?.activeModel ?? null).toBeNull();
    expect(captured?.activeProvider ?? null).toBeNull();
  });

  it("reload re-reads config from disk", async () => {
    let captured: Config | undefined;
    let capturedReload: (() => void) | undefined;

    /** Captures config and reload from the hook. */
    function Harness() {
      const { config, reload } = useConfig();
      captured = config;
      capturedReload = reload;
      return <Text>{config.activeModel ?? "none"}</Text>;
    }

    const { lastFrame, fsState } = renderInk(<Harness />, {
      global: { activeModel: "llama3", activeProvider: "my-ollama" },
    });

    expect(captured?.activeModel).toBe("llama3");

    // Swap the mock fs to simulate config changing on disk
    fsState.restore();
    const newFs = mockConfig({
      global: { activeModel: "gpt-4", activeProvider: "my-ollama" },
    });

    capturedReload?.();
    await new Promise((r) => setTimeout(r, 50));

    expect(captured?.activeModel).toBe("gpt-4");
    expect(lastFrame()).toContain("gpt-4");
    newFs.restore();
  });
});
