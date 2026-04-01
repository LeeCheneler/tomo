import { describe, expect, it } from "vitest";
import { theme } from "./theme";

describe("theme", () => {
  it("defines all expected color keys", () => {
    expect(theme.brand).toBe("cyan");
    expect(theme.history).toBe("magenta");
    expect(theme.error).toBe("red");
    expect(theme.warning).toBe("yellow");
    expect(theme.success).toBe("green");
  });
});
