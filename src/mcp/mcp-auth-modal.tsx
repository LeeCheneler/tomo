import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { splitAtCursor } from "../input/cursor";
import { processTextEdit } from "../input/text-edit";
import { Border } from "../ui/border";
import type { InstructionItem } from "../ui/key-instructions";
import { KeyInstructions } from "../ui/key-instructions";
import { Indent } from "../ui/layout/indent";
import { LoadingIndicator } from "../ui/loading-indicator";
import { theme } from "../ui/theme";

/** Key instructions for the default (browser) mode. */
const BROWSER_INSTRUCTIONS: InstructionItem[] = [
  { key: "esc", description: "cancel" },
];

/** Key instructions for the headless paste mode. */
const HEADLESS_INSTRUCTIONS: InstructionItem[] = [
  { key: "enter", description: "submit" },
  { key: "esc", description: "cancel" },
];

/** Props for McpAuthModal. */
export interface McpAuthModalProps {
  /** Name of the MCP server that is awaiting authorization. */
  serverName: string;
  /** Full authorization URL the user should visit in their browser. */
  authUrl: string;
  /** When true, a paste-URL input is shown instead of the "waiting for browser" spinner. */
  headless?: boolean;
  /** Called when the user cancels the flow (Esc). */
  onCancel: () => void;
  /**
   * Called with the full pasted callback URL when the user submits in
   * headless mode. The upstream caller is responsible for parsing the URL
   * and extracting the authorization code.
   */
  onPasteUrl?: (callbackUrl: string) => void;
}

/** Drives Esc-to-cancel for the auth modal. */
function useMcpAuthModal(props: McpAuthModalProps) {
  useInput((_input, key) => {
    if (key.escape) {
      props.onCancel();
    }
  });
}

/** Props for the headless paste-URL input. */
interface PasteUrlInputProps {
  onSubmit: (value: string) => void;
}

/** Text input that captures the pasted callback URL. */
function PasteUrlInput(props: PasteUrlInputProps) {
  const [value, setValue] = useState("");
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    if (key.return) {
      if (value.trim()) props.onSubmit(value.trim());
      return;
    }
    if (key.escape) return; // handled by parent useMcpAuthModal
    const result = processTextEdit(input, key, value, cursor);
    if (result) {
      if (result.value !== value) setValue(result.value);
      if (result.cursor !== cursor) setCursor(result.cursor);
    }
  });

  const split = splitAtCursor(value, cursor);

  return (
    <Indent>
      <Text color={theme.brand}>{"❯ "}</Text>
      <Text>
        {split.before}
        <Text inverse>{split.at}</Text>
        {split.after}
      </Text>
    </Indent>
  );
}

/**
 * Bordered modal shown while an MCP server is driving the user through an
 * OAuth flow. In the default (browser) mode it displays the server name, the
 * authorization URL, and an animated "waiting for browser" indicator; in the
 * headless mode it replaces the indicator with a paste-URL input so the user
 * can finish the flow on a host without a browser. Esc cancels.
 *
 * The component is purely presentational — all lifecycle concerns (the
 * loopback catcher, browser launch, promise race) live upstream.
 */
export function McpAuthModal(props: McpAuthModalProps) {
  useMcpAuthModal(props);

  const instructions = props.headless
    ? HEADLESS_INSTRUCTIONS
    : BROWSER_INSTRUCTIONS;

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Border color={theme.brand} />
      <Indent>
        <Text color={theme.brand}>
          Authorize MCP server: {props.serverName}
        </Text>
      </Indent>
      <Box paddingTop={1}>
        <Indent>
          <Text dimColor>
            {props.headless
              ? "Visit the URL below, then paste the full callback URL:"
              : "Opening your browser — sign in to complete the flow."}
          </Text>
        </Indent>
      </Box>
      <Box paddingTop={1}>
        <Indent>
          <Text>{props.authUrl}</Text>
        </Indent>
      </Box>
      <Box paddingTop={1}>
        {props.headless ? (
          props.onPasteUrl !== undefined ? (
            <PasteUrlInput onSubmit={props.onPasteUrl} />
          ) : null
        ) : (
          <Indent>
            <LoadingIndicator text="waiting for browser…" />
          </Indent>
        )}
      </Box>
      <Border color={theme.brand} />
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions items={instructions} />
      </Box>
    </Box>
  );
}
