import { describe, expect, it, vi } from "vitest";
import { renderInk } from "../test-utils/ink";
import { keys } from "../test-utils/keys";
import type { FormField } from "./form";
import { Form } from "./form";

const FIELDS: FormField[] = [
  { type: "toggle", key: "enabled", label: "Enabled", initialValue: true },
  {
    type: "select",
    key: "provider",
    label: "Type",
    options: ["ollama", "opencode-zen", "openrouter"],
    initialValue: "ollama",
  },
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
      expect(frame).toContain("Type");
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

    it("shows select field with all options", () => {
      const { lastFrame } = renderForm();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("Type:");
      expect(frame).toContain("ollama");
      expect(frame).toContain("opencode-zen");
      expect(frame).toContain("openrouter");
    });

    it("shows checkmark on selected option", () => {
      const { lastFrame } = renderForm();
      const frame = lastFrame() ?? "";
      expect(frame).toContain("[✓] ollama");
      expect(frame).toContain("[ ] opencode-zen");
      expect(frame).toContain("[ ] openrouter");
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
      expect(lastFrame()).toContain("Type:");
    });

    it("moves cursor up", async () => {
      const { stdin, lastFrame } = renderForm();
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.up);
      // Back on Type (select field)
      expect(lastFrame()).toContain("❯");
    });

    it("positions text cursor when navigating up into a text field", async () => {
      const { stdin, lastFrame } = renderForm();
      // Go to Verbose (index 3), then up into API Key (text at index 2)
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.up);
      await stdin.write("!");
      expect(lastFrame()).toContain("tvly-123!");
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

  describe("select fields", () => {
    it("selects next option on right arrow", async () => {
      const { stdin, lastFrame } = renderForm();
      await stdin.write(keys.down);
      await stdin.write(keys.right);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("[ ] ollama");
      expect(frame).toContain("[✓] opencode-zen");
    });

    it("selects previous option on left arrow", async () => {
      const { stdin, lastFrame } = renderForm();
      await stdin.write(keys.down);
      await stdin.write(keys.right);
      await stdin.write(keys.left);
      const frame = lastFrame() ?? "";
      expect(frame).toContain("[✓] ollama");
    });

    it("wraps around forward", async () => {
      const { stdin, lastFrame } = renderForm();
      await stdin.write(keys.down);
      await stdin.write(keys.right);
      await stdin.write(keys.right);
      await stdin.write(keys.right);
      expect(lastFrame()).toContain("[✓] ollama");
    });

    it("wraps around backward", async () => {
      const { stdin, lastFrame } = renderForm();
      await stdin.write(keys.down);
      await stdin.write(keys.left);
      expect(lastFrame()).toContain("[✓] openrouter");
    });

    it("ignores typed characters", async () => {
      const { stdin, lastFrame } = renderForm();
      await stdin.write(keys.down);
      await stdin.write("abc");
      expect(lastFrame()).toContain("[✓] ollama");
    });

    it("includes select value in submitted values", async () => {
      const { stdin, onSubmit } = renderForm();
      await stdin.write(keys.down);
      await stdin.write(keys.right);
      await stdin.write(keys.enter);
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "opencode-zen" }),
      );
    });
  });

  describe("text fields", () => {
    it("accepts typed input when focused", async () => {
      const { stdin, lastFrame } = renderForm();
      // Navigate past toggle and select to text field
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write("-extra");
      expect(lastFrame()).toContain("tvly-123-extra");
    });

    it("handles backspace", async () => {
      const { stdin, lastFrame } = renderForm();
      await stdin.write(keys.down);
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
      // Navigate down past select to API Key, then type
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write("!");
      // Character should be appended at the end
      expect(lastFrame()).toContain("tvly-123!");
    });

    it("ignores control sequences", async () => {
      const { stdin, lastFrame } = renderForm();
      await stdin.write(keys.down);
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
        provider: "ollama",
        apiKey: "tvly-123",
        verbose: false,
      });
    });

    it("calls onSubmit with modified values", async () => {
      const { stdin, onSubmit } = renderForm();
      // Toggle first field off
      await stdin.write(keys.space);
      // Change select field
      await stdin.write(keys.down);
      await stdin.write(keys.right);
      // Navigate to text field and edit
      await stdin.write(keys.down);
      await stdin.write("-new");
      // Submit
      await stdin.write(keys.enter);
      expect(onSubmit).toHaveBeenCalledWith({
        enabled: false,
        provider: "opencode-zen",
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

  describe("kv fields", () => {
    /** Renders Form with a kv field and spied callbacks. */
    function renderWithKv(initialValue: Record<string, string> = {}) {
      const fields: FormField[] = [
        {
          type: "text",
          key: "command",
          label: "Command",
          initialValue: "node",
        },
        { type: "kv", key: "env", label: "Env", initialValue },
      ];
      const onSubmit = vi.fn();
      const onCancel = vi.fn();
      const onOpenField = vi.fn();
      const result = renderInk(
        <Form
          fields={fields}
          onSubmit={onSubmit}
          onCancel={onCancel}
          onOpenField={onOpenField}
        />,
      );
      return { ...result, onSubmit, onCancel, onOpenField };
    }

    it("renders the kv field as a count summary", () => {
      const { lastFrame } = renderWithKv({ FOO: "bar", BAZ: "qux" });
      expect(lastFrame()).toContain("Env: 2 entries");
    });

    it("uses the singular form for one entry", () => {
      const { lastFrame } = renderWithKv({ FOO: "bar" });
      expect(lastFrame()).toContain("Env: 1 entry");
    });

    it("renders zero entries", () => {
      const { lastFrame } = renderWithKv({});
      expect(lastFrame()).toContain("Env: 0 entries");
    });

    it("renders the chevron affordance on the kv field", () => {
      const { lastFrame } = renderWithKv({ FOO: "bar" });
      // Find the line containing the kv summary and assert it carries the chevron.
      const envLine = (lastFrame() ?? "")
        .split("\n")
        .find((l) => l.includes("Env: 1 entry"));
      expect(envLine).toContain("›");
    });

    it("fires onOpenField with the field key and current values when tab is pressed", async () => {
      const { stdin, onOpenField } = renderWithKv({ FOO: "bar" });
      await stdin.write(keys.down);
      await stdin.write(keys.tab);
      expect(onOpenField).toHaveBeenCalledWith("env", {
        command: "node",
        env: { FOO: "bar" },
      });
    });

    it("does not fire onOpenField for tab on a non-kv field", async () => {
      const { stdin, onOpenField } = renderWithKv();
      // Cursor starts on the text field; tab should be ignored.
      await stdin.write(keys.tab);
      expect(onOpenField).not.toHaveBeenCalled();
    });

    it("includes the kv value in onSubmit", async () => {
      const { stdin, onSubmit } = renderWithKv({ FOO: "bar" });
      await stdin.write(keys.enter);
      expect(onSubmit).toHaveBeenCalledWith({
        command: "node",
        env: { FOO: "bar" },
      });
    });

    it("ignores typed input when focused on a kv field", async () => {
      const { stdin, lastFrame } = renderWithKv({ FOO: "bar" });
      await stdin.write(keys.down);
      await stdin.write("hello");
      // Summary unchanged
      expect(lastFrame()).toContain("Env: 1 entry");
    });

    it("can navigate past a kv field with up/down", async () => {
      const fields: FormField[] = [
        { type: "text", key: "a", label: "A", initialValue: "alpha" },
        { type: "kv", key: "kv", label: "KV", initialValue: {} },
        { type: "text", key: "b", label: "B", initialValue: "beta" },
      ];
      const onSubmit = vi.fn();
      const { stdin } = renderInk(
        <Form fields={fields} onSubmit={onSubmit} onCancel={vi.fn()} />,
      );
      // Move from A → KV → B, then submit
      await stdin.write(keys.down);
      await stdin.write(keys.down);
      await stdin.write(keys.enter);
      expect(onSubmit).toHaveBeenCalledWith({
        a: "alpha",
        kv: {},
        b: "beta",
      });
    });
  });
});
