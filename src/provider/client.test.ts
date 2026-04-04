import { describe, it, expect, vi, afterEach } from "vitest";
import {
  resolveApiKey,
  PROVIDER_DEFAULT_URLS,
  DEFAULT_CONTEXT_WINDOW,
} from "./client";

describe("resolveApiKey", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns config apiKey when provided", () => {
    expect(resolveApiKey("ollama", "sk-config")).toBe("sk-config");
  });

  it("falls back to OLLAMA_API_KEY env var for ollama", () => {
    vi.stubEnv("OLLAMA_API_KEY", "sk-env");
    expect(resolveApiKey("ollama")).toBe("sk-env");
  });

  it("returns undefined for ollama with no config or env key", () => {
    expect(resolveApiKey("ollama")).toBeUndefined();
  });

  it("falls back to OPENCODE_API_KEY env var for opencode-zen", () => {
    vi.stubEnv("OPENCODE_API_KEY", "sk-env");
    expect(resolveApiKey("opencode-zen")).toBe("sk-env");
  });

  it("falls back to OPENROUTER_API_KEY env var for openrouter", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "sk-env");
    expect(resolveApiKey("openrouter")).toBe("sk-env");
  });

  it("prefers config key over env var", () => {
    vi.stubEnv("OPENCODE_API_KEY", "sk-env");
    expect(resolveApiKey("opencode-zen", "sk-config")).toBe("sk-config");
  });

  it("returns undefined when no key is available", () => {
    vi.stubEnv("OPENROUTER_API_KEY", "");
    expect(resolveApiKey("openrouter")).toBeUndefined();
  });
});

describe("PROVIDER_DEFAULT_URLS", () => {
  it("has default URL for ollama", () => {
    expect(PROVIDER_DEFAULT_URLS.ollama).toBe("http://localhost:11434");
  });

  it("has default URL for opencode-zen", () => {
    expect(PROVIDER_DEFAULT_URLS["opencode-zen"]).toBe(
      "https://opencode.ai/zen",
    );
  });

  it("has default URL for openrouter", () => {
    expect(PROVIDER_DEFAULT_URLS.openrouter).toBe("https://openrouter.ai/api");
  });
});

describe("DEFAULT_CONTEXT_WINDOW", () => {
  it("is 8192", () => {
    expect(DEFAULT_CONTEXT_WINDOW).toBe(8192);
  });
});
