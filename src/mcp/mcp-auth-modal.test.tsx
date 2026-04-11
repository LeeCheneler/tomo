import { describe, expect, it, vi } from "vitest";
import { renderInk } from "../test-utils/ink";
import { keys } from "../test-utils/keys";
import { McpAuthModal } from "./mcp-auth-modal";

const AUTH_URL =
  "https://auth.example.com/authorize?response_type=code&state=abc123&code_challenge=xyz";

describe("McpAuthModal", () => {
  describe("browser mode", () => {
    it("renders the server name, auth URL, and browser hint", () => {
      const { lastFrame } = renderInk(
        <McpAuthModal
          serverName="github"
          authUrl={AUTH_URL}
          onCancel={vi.fn()}
        />,
      );
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Authorize MCP server: github");
      expect(frame).toContain(AUTH_URL);
      expect(frame).toContain("Opening your browser");
      expect(frame).toContain("esc");
      expect(frame).toContain("cancel");
    });

    it("does not render a paste-URL prompt", () => {
      const { lastFrame } = renderInk(
        <McpAuthModal
          serverName="github"
          authUrl={AUTH_URL}
          onCancel={vi.fn()}
        />,
      );
      const frame = lastFrame() ?? "";
      expect(frame).not.toContain("paste the full callback URL");
    });

    it("fires onCancel when Esc is pressed", async () => {
      const onCancel = vi.fn();
      const { stdin } = renderInk(
        <McpAuthModal
          serverName="github"
          authUrl={AUTH_URL}
          onCancel={onCancel}
        />,
      );
      await stdin.write(keys.escape);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe("headless mode", () => {
    it("renders the paste-URL hint and a prompt cursor", () => {
      const { lastFrame } = renderInk(
        <McpAuthModal
          serverName="github"
          authUrl={AUTH_URL}
          headless
          onCancel={vi.fn()}
          onPasteUrl={vi.fn()}
        />,
      );
      const frame = lastFrame() ?? "";
      expect(frame).toContain("paste the full callback URL");
      expect(frame).toContain("❯");
      expect(frame).toContain("enter");
      expect(frame).toContain("submit");
    });

    it("does not crash when no paste handler is provided", () => {
      const { lastFrame } = renderInk(
        <McpAuthModal
          serverName="github"
          authUrl={AUTH_URL}
          headless
          onCancel={vi.fn()}
        />,
      );
      const frame = lastFrame() ?? "";
      expect(frame).toContain("paste the full callback URL");
    });

    it("captures typed input and fires onPasteUrl on enter", async () => {
      const onPasteUrl = vi.fn();
      const { stdin } = renderInk(
        <McpAuthModal
          serverName="github"
          authUrl={AUTH_URL}
          headless
          onCancel={vi.fn()}
          onPasteUrl={onPasteUrl}
        />,
      );
      await stdin.write("http://127.0.0.1:54321/callback?code=xyz&state=abc");
      await stdin.write(keys.enter);
      expect(onPasteUrl).toHaveBeenCalledWith(
        "http://127.0.0.1:54321/callback?code=xyz&state=abc",
      );
    });

    it("does not fire onPasteUrl on empty submit", async () => {
      const onPasteUrl = vi.fn();
      const { stdin } = renderInk(
        <McpAuthModal
          serverName="github"
          authUrl={AUTH_URL}
          headless
          onCancel={vi.fn()}
          onPasteUrl={onPasteUrl}
        />,
      );
      await stdin.write(keys.enter);
      expect(onPasteUrl).not.toHaveBeenCalled();
    });

    it("ignores keys that processTextEdit does not handle (e.g. tab)", async () => {
      // processTextEdit returns null for keys like tab and up/down arrows.
      // The modal should not crash or submit anything on those.
      const onPasteUrl = vi.fn();
      const { stdin } = renderInk(
        <McpAuthModal
          serverName="github"
          authUrl={AUTH_URL}
          headless
          onCancel={vi.fn()}
          onPasteUrl={onPasteUrl}
        />,
      );
      await stdin.write(keys.tab);
      await stdin.write(keys.enter);
      expect(onPasteUrl).not.toHaveBeenCalled();
    });

    it("is a no-op when a text-edit key returns an unchanged result (e.g. left arrow at start)", async () => {
      // processTextEdit returns `{value, cursor: 0}` for a left arrow at
      // column 0 — both fields match the current state so neither setter
      // should fire. Exercised here purely to cover the equality guards.
      const onPasteUrl = vi.fn();
      const { stdin } = renderInk(
        <McpAuthModal
          serverName="github"
          authUrl={AUTH_URL}
          headless
          onCancel={vi.fn()}
          onPasteUrl={onPasteUrl}
        />,
      );
      await stdin.write(keys.left);
      await stdin.write(keys.enter);
      expect(onPasteUrl).not.toHaveBeenCalled();
    });

    it("does not fire onPasteUrl on whitespace-only submit", async () => {
      const onPasteUrl = vi.fn();
      const { stdin } = renderInk(
        <McpAuthModal
          serverName="github"
          authUrl={AUTH_URL}
          headless
          onCancel={vi.fn()}
          onPasteUrl={onPasteUrl}
        />,
      );
      await stdin.write("   ");
      await stdin.write(keys.enter);
      expect(onPasteUrl).not.toHaveBeenCalled();
    });

    it("fires onCancel when Esc is pressed", async () => {
      const onCancel = vi.fn();
      const { stdin } = renderInk(
        <McpAuthModal
          serverName="github"
          authUrl={AUTH_URL}
          headless
          onCancel={onCancel}
          onPasteUrl={vi.fn()}
        />,
      );
      await stdin.write(keys.escape);
      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });
});
