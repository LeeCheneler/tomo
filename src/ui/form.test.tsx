import { describe, expect, it, vi } from "vitest";
import { renderInk } from "../test-utils/ink";
import { keys } from "../test-utils/keys";
import type { FormField } from "./form";
import { Form } from "./form";

const FIELDS: FormField[] = [
  { type: "toggle", key: "enabled", label: "Enabled", initialValue: true },
  { type: "text", key: "apiKey", label: "API Key", initialValue: "tvly-123" },
  { type: "toggle", key: "verbose", label: "Verbose", initialValue: false },
];

describe("Form", () => {
  /** Renders Form with spy callbacks. */
  function renderForm(fields: readonly FormField[] = FIELDS, color?: string) {
    const onSubmit = vi.fn();
    const onCancel = vi.fn();
    const result = renderInk(
      <Form
        fields={fields}
        onSubmit={onSubmit}
        onCancel={onCancel}
        color={color}
      />,
    );
    return { ...result, onSubmit, onCancel };
  }

  describe("rendering", () => {
    it("renders all field labels", () => {
      const { lastFrame } = renderForm();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Enabled");
      expect(frame).toContain("API Key");
      expect(frame).toContain("Verbose");
    });

    it("shows cursor on the first field", () => {
      const { lastFrame } = renderForm();
      expect(lastFrame()).toContain("❯");
    });

    it("shows toggle indicators", () => {
      const { lastFrame } = renderForm();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("[✓] Enabled");
      expect(frame).toContain("[ ] Verbose");
    });

    it("shows text field value", () => {
      const { lastFrame } = renderForm();
      expect(lastFrame()).toContain("API Key: tvly-123");
    });

    it("renders empty when no fields provided", () => {
      const { lastFrame } = renderForm([]);
      expect(lastFrame()).toBe("");
    });

    it("ignores input when no fields provided", async () => {
      const { stdin, onSubmit, onCancel } = renderForm([]);
      await stdin.write(keys.down);
      await stdin.write(keys.space);
      expect(onSubmit).not.toHaveBeenCalled();
      expect(onCancel).not.toHaveBeenCalled();
    });
  });

  describe("navigation", () => {
    it("moves cursor down", async () => {
      const { stdin, lastFrame } = renderForm();
      await stdin.write(keys.down);
      expect(lastFrame()).toContain("❯");
      expect(lastFrame()).toContain("API Key:");
    });

    it("moves cursor up", async () => {
      const { stdin, lastFrame } = renderForm();
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.up);
      // Back on API Key
      expect(lastFrame()).toContain("❯");
    });

    it("loops from top to bottom", async () => {
      const { stdin, lastFrame } = renderForm();
      await stdin.write(keys.up);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("[ ] Verbose");
    });

    it("loops from bottom to top", async () => {
      const { stdin, lastFrame } = renderForm();
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      expect(lastFrame()).toContain("[✓] Enabled");
    });
  });

  describe("toggle fields", () => {
    it("toggles on space", async () => {
      const { stdin, lastFrame } = renderForm();
      await stdin.write(keys.space);
      expect(lastFrame()).toContain("[ ] Enabled");
    });

    it("does not toggle on enter (enter submits)", async () => {
      const { stdin, onSubmit } = renderForm();
      await stdin.write(keys.enter);
      expect(onSubmit).toHaveBeenCalledOnce();
    });

    it("toggles back on second space", async () => {
      const { stdin, lastFrame } = renderForm();
      await stdin.write(keys.space);
      await stdin.write(keys.space);
      expect(lastFrame()).toContain("[✓] Enabled");
    });
  });

  describe("text fields", () => {
    it("accepts typed input when focused", async () => {
      const { stdin, lastFrame } = renderForm();
      await stdin.write(keys.down);
      await stdin.write("-extra");
      expect(lastFrame()).toContain("tvly-123-extra");
    });

    it("handles backspace", async () => {
      const { stdin, lastFrame } = renderForm();
      await stdin.write(keys.down);
      await stdin.write(keys.delete);
      await stdin.write(keys.delete);
      await stdin.write(keys.delete);
      expect(lastFrame()).toContain("API Key: tvly-");
    });

    it("ignores backspace at start of text", async () => {
      const { stdin, lastFrame } = renderForm([
        { type: "text", key: "name", label: "Name", initialValue: "" },
      ]);
      await stdin.write(keys.delete);
      expect(lastFrame()).toContain("Name:");
    });

    it("moves text cursor left and right", async () => {
      const { stdin, lastFrame } = renderForm([
        { type: "text", key: "val", label: "Value", initialValue: "abc" },
      ]);
      await stdin.write(keys.left);
      await stdin.write("X");
      expect(lastFrame()).toContain("abXc");
    });

    it("clamps text cursor at boundaries", async () => {
      const { stdin, lastFrame } = renderForm([
        { type: "text", key: "val", label: "Value", initialValue: "ab" },
      ]);
      // Move right past end
      await stdin.write(keys.right);
      await stdin.write(keys.right);
      await stdin.write("X");
      expect(lastFrame()).toContain("abX");
      // Move left past start
      await stdin.write(keys.left);
      await stdin.write(keys.left);
      await stdin.write(keys.left);
      await stdin.write(keys.left);
      await stdin.write("Y");
      expect(lastFrame()).toContain("YabX");
    });

    it("positions cursor at end when navigating to text field", async () => {
      const { stdin, lastFrame } = renderForm();
      // Navigate down to API Key, then type
      await stdin.write(keys.down);
      await stdin.write("!");
      // Character should be appended at the end
      expect(lastFrame()).toContain("tvly-123!");
    });

    it("ignores control sequences", async () => {
      const { stdin, lastFrame } = renderForm();
      await stdin.write(keys.down);
      await stdin.write(keys.tab);
      expect(lastFrame()).toContain("tvly-123");
    });

    it("space inserts a space character in text fields", async () => {
      const { stdin, lastFrame } = renderForm([
        { type: "text", key: "val", label: "Value", initialValue: "" },
      ]);
      await stdin.write("a b");
      expect(lastFrame()).toContain("a b");
    });
  });

  describe("submit", () => {
    it("calls onSubmit with current values on enter", async () => {
      const { stdin, onSubmit } = renderForm();
      await stdin.write(keys.enter);
      expect(onSubmit).toHaveBeenCalledWith({
        enabled: true,
        apiKey: "tvly-123",
        verbose: false,
      });
    });

    it("calls onSubmit with modified values", async () => {
      const { stdin, onSubmit } = renderForm();
      // Toggle first field off
      await stdin.write(keys.space);
      // Navigate to text field and edit
      await stdin.write(keys.down);
      await stdin.write("-new");
      // Submit
      await stdin.write(keys.enter);
      expect(onSubmit).toHaveBeenCalledWith({
        enabled: false,
        apiKey: "tvly-123-new",
        verbose: false,
      });
    });
  });

  describe("cancel", () => {
    it("calls onCancel on escape", async () => {
      const { stdin, onCancel } = renderForm();
      await stdin.write(keys.escape);
      expect(onCancel).toHaveBeenCalledOnce();
    });

    it("does not call onSubmit on escape", async () => {
      const { stdin, onSubmit } = renderForm();
      await stdin.write(keys.escape);
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });
});
