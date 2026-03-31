import { Box, Text } from "ink";
import { useRef, useState } from "react";
import { useTextInput } from "../input/text";
import { theme } from "../ui/theme";

/** Props for the ChatInput component. */
export interface ChatInputProps {
  /** Called when the user submits a message. */
  onMessage: (message: string) => void;
}

/** Returns the terminal width, defaulting to 80 if unavailable. */
function getTerminalWidth(): number {
  return process.stdout.columns || 80;
}

/** Builds a full-width border line of ─ characters. */
function buildBorder(): string {
  return "─".repeat(getTerminalWidth());
}

/** Manages chat input state and submission. */
function useChatInput(props: ChatInputProps) {
  const [value, setValue] = useState("");
  // Ref keeps value fresh across batched React updates so submit
  // always sees the latest input even before re-render.
  const valueRef = useRef("");

  /** Updates value in both state (for rendering) and ref (for callbacks). */
  function handleChange(newValue: string) {
    valueRef.current = newValue;
    setValue(newValue);
  }

  /** Submits the current value if non-empty, then clears the input. */
  function handleSubmit() {
    const current = valueRef.current;
    if (current.trim() === "") {
      return;
    }
    props.onMessage(current);
    handleChange("");
    setCursorPos(0);
  }

  const { cursor, setCursor: setCursorPos } = useTextInput({
    value,
    onChange: handleChange,
    onSubmit: handleSubmit,
    lineMode: "multi",
  });

  return { value, cursor };
}

/** Chat input with bordered text area. */
export function ChatInput(props: ChatInputProps) {
  const { value, cursor } = useChatInput(props);

  const beforeCursor = value.slice(0, cursor);
  const atCursor = value[cursor] ?? " ";
  const afterCursor = value.slice(cursor + 1);

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Text color={theme.brand}>{buildBorder()}</Text>
      <Text>
        <Text color={theme.brand}>{"❯ "}</Text>
        {beforeCursor}
        <Text inverse>{atCursor}</Text>
        {afterCursor}
      </Text>
      <Text color={theme.brand}>{buildBorder()}</Text>
    </Box>
  );
}
