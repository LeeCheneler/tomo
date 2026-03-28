import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "./env";

describe("env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("get", () => {
    it("returns the value when set", () => {
      vi.stubEnv("TEST_VAR", "hello");
      expect(env.get("TEST_VAR")).toBe("hello");
    });

    it("throws when not set", () => {
      expect(() => env.get("MISSING_VAR")).toThrow(
        "Missing required environment variable: MISSING_VAR",
      );
    });

    it("throws when empty string", () => {
      vi.stubEnv("EMPTY_VAR", "");
      expect(() => env.get("EMPTY_VAR")).toThrow(
        "Missing required environment variable: EMPTY_VAR",
      );
    });
  });

  describe("getOptional", () => {
    it("returns the value when set", () => {
      vi.stubEnv("TEST_VAR", "hello");
      expect(env.getOptional("TEST_VAR")).toBe("hello");
    });

    it("returns undefined when not set", () => {
      expect(env.getOptional("MISSING_VAR")).toBeUndefined();
    });
  });
});
