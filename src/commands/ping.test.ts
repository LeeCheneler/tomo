import { describe, expect, it } from "vitest";
import { pingCommand } from "./ping";

describe("pingCommand", () => {
  it("is named ping", () => {
    expect(pingCommand.name).toBe("ping");
  });

  it("returns pong", () => {
    expect(pingCommand.handler()).toBe("pong");
  });
});
