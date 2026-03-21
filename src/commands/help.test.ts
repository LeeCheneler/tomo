import { describe, it, expect } from "vitest";
import "../commands";
import { getAllCommands } from "./registry";
import type { CommandCallbacks } from "./types";

const stubCallbacks = {} as CommandCallbacks;

describe("/help", () => {
  it("lists all registered commands", () => {
    const help = getAllCommands().find((c) => c.name === "help");
    expect(help).toBeDefined();
    if (!help) return;

    const result = help.execute("", stubCallbacks);
    expect("output" in result).toBe(true);

    const output = (result as { output: string }).output;
    const commands = getAllCommands();

    for (const cmd of commands) {
      expect(output).toContain(`/${cmd.name}`);
      expect(output).toContain(cmd.description);
    }
  });
});
