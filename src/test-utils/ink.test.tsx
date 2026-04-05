import { Text, useInput } from "ink";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { useConfig } from "../config/hook";
import type { Config } from "../config/schema";
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

  it("provides default config via ConfigProvider", () => {
    let captured: Config | undefined;

    /** Captures config from context. */
    function Harness() {
      const { config } = useConfig();
      captured = config;
      return null;
    }

    renderInk(<Harness />);
    expect(captured).toBeDefined();
    expect(captured?.providers).toEqual([]);
  });

  it("provides global config overrides via second argument", () => {
    let captured: Config | undefined;

    /** Captures config from context. */
    function Harness() {
      const { config } = useConfig();
      captured = config;
      return null;
    }

    renderInk(<Harness />, {
      global: { activeModel: "llama3", activeProvider: "my-ollama" },
    });
    expect(captured?.activeModel).toBe("llama3");
    expect(captured?.activeProvider).toBe("my-ollama");
  });

  it("provides local config overrides via second argument", () => {
    let captured: Config | undefined;

    /** Captures config from context. */
    function Harness() {
      const { config } = useConfig();
      captured = config;
      return null;
    }

    renderInk(<Harness />, {
      local: { allowedCommands: ["npm test"] },
    });
    expect(captured?.allowedCommands).toEqual(["npm test"]);
  });

  it("getConfig returns the current context config", () => {
    const { getConfig } = renderInk(<Text>test</Text>, {
      global: { activeModel: "llama3" },
    });
    expect(getConfig().activeModel).toBe("llama3");
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
