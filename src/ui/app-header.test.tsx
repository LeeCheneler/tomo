import { renderInk } from "../test-utils/ink";
import { describe, expect, it } from "vitest";
import { AppHeader } from "./app-header";

describe("AppHeader", () => {
  it("renders the logo", () => {
    const { lastFrame } = renderInk(
      <AppHeader version="1.0.0" model="qwen3:8b" provider="ollama" />,
    );
    expect(lastFrame()).toContain("╔╦╗╔═╗╔╦╗╔═╗");
  });

  it("renders the tagline", () => {
    const { lastFrame } = renderInk(
      <AppHeader version="1.0.0" model="qwen3:8b" provider="ollama" />,
    );
    expect(lastFrame()).toContain("友");
    expect(lastFrame()).toContain("your local AI companion");
  });

  it("renders version, model, and provider", () => {
    const { lastFrame } = renderInk(
      <AppHeader version="2.5.0" model="llama3:70b" provider="openrouter" />,
    );
    expect(lastFrame()).toContain("v2.5.0 · llama3:70b (openrouter)");
  });

  it("renders fallback when model is null", () => {
    const { lastFrame } = renderInk(
      <AppHeader version="1.0.0" model={null} provider="ollama" />,
    );
    expect(lastFrame()).toContain("No active model or provider");
  });

  it("renders fallback when provider is null", () => {
    const { lastFrame } = renderInk(
      <AppHeader version="1.0.0" model="qwen3:8b" provider={null} />,
    );
    expect(lastFrame()).toContain("No active model or provider");
  });

  it("renders fallback when both are undefined", () => {
    const { lastFrame } = renderInk(
      <AppHeader version="1.0.0" model={undefined} provider={undefined} />,
    );
    expect(lastFrame()).toContain("No active model or provider");
  });
});
