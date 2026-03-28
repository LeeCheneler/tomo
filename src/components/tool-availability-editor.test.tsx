import { render } from "ink-testing-library";
import { describe, expect, it, vi } from "vitest";
import type { SettingsState, ToolMeta } from "./settings-selector";
import { ToolAvailabilityEditor } from "./tool-availability-editor";

const flush = () => new Promise((r) => setTimeout(r, 50));

const toolMeta: ToolMeta = {
  names: ["read_file", "write_file"],
  displayNames: { read_file: "Read File", write_file: "Write File" },
  descriptions: { read_file: "Read file contents" },
  warnings: {},
};

const baseState: SettingsState = {
  toolAvailability: { read_file: true, write_file: true },
  permissions: {},
  allowedCommands: [],
  mcpServers: {},
};

function renderEditor(overrides?: {
  state?: Partial<SettingsState>;
  onUpdate?: (partial: Partial<SettingsState>) => void;
  onBack?: () => void;
}) {
  const onUpdate = overrides?.onUpdate ?? vi.fn();
  const onBack = overrides?.onBack ?? vi.fn();
  const result = render(
    <ToolAvailabilityEditor
      state={{ ...baseState, ...overrides?.state }}
      toolMeta={toolMeta}
      onUpdate={onUpdate}
      onBack={onBack}
    />,
  );
  return { ...result, onUpdate, onBack };
}

describe("ToolAvailabilityEditor", () => {
  it("shows built-in tools", () => {
    const { lastFrame } = renderEditor();
    const output = lastFrame() ?? "";
    expect(output).toContain("Read File");
    expect(output).toContain("Write File");
  });

  it("shows tool descriptions", () => {
    const { lastFrame } = renderEditor();
    expect(lastFrame()).toContain("Read file contents");
  });

  it("toggles built-in tool", async () => {
    const onUpdate = vi.fn();
    const { stdin } = renderEditor({ onUpdate });

    stdin.write(" ");
    await flush();

    expect(onUpdate).toHaveBeenCalledWith({
      toolAvailability: expect.objectContaining({ read_file: false }),
    });
  });

  it("calls onBack on Esc", async () => {
    const onBack = vi.fn();
    const { stdin } = renderEditor({ onBack });

    stdin.write("\x1B");
    await flush();

    expect(onBack).toHaveBeenCalled();
  });

  it("shows MCP tools grouped by server", () => {
    const { lastFrame } = renderEditor({
      state: {
        mcpServers: {
          "weather-api": {
            transport: "http",
            url: "https://example.com",
            tools: [
              {
                name: "get_weather",
                enabled: true,
                description: "Returns weather",
              },
            ],
          },
        },
      },
    });

    const output = lastFrame() ?? "";
    expect(output).toContain("MCP → weather-api");
    expect(output).toContain("get_weather");
    expect(output).toContain("Returns weather");
  });

  it("toggles MCP tool", async () => {
    const onUpdate = vi.fn();
    const { stdin } = renderEditor({
      state: {
        mcpServers: {
          server: {
            transport: "http",
            url: "https://example.com",
            tools: [{ name: "tool_a", enabled: true }],
          },
        },
      },
      onUpdate,
    });

    // Navigate past 2 built-in tools
    stdin.write("\x1B[B");
    await flush();
    stdin.write("\x1B[B");
    await flush();
    stdin.write(" ");
    await flush();

    expect(onUpdate).toHaveBeenCalledWith({
      mcpServers: expect.objectContaining({
        server: expect.objectContaining({
          tools: [{ name: "tool_a", enabled: false }],
        }),
      }),
    });
  });

  it("hides tools from disabled servers", () => {
    const { lastFrame } = renderEditor({
      state: {
        mcpServers: {
          disabled: {
            transport: "http",
            url: "https://example.com",
            enabled: false,
            tools: [{ name: "hidden", enabled: true }],
          },
        },
      },
    });

    const output = lastFrame() ?? "";
    expect(output).not.toContain("disabled");
    expect(output).not.toContain("hidden");
  });
});
