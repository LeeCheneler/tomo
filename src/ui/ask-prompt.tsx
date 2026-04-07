import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { splitAtCursor } from "../input/cursor";
import { processTextEdit } from "../input/text-edit";
import { Border } from "./border";
import type { InstructionItem } from "./key-instructions";
import { KeyInstructions } from "./key-instructions";
import { Indent } from "./layout/indent";
import type { SelectListItem } from "./select-list";
import { SelectList } from "./select-list";
import { theme } from "./theme";

/** Key instructions for the ask panel with options. */
const OPTIONS_INSTRUCTIONS: InstructionItem[] = [
  { key: "enter", description: "select" },
  { key: "tab", description: "type response" },
  { key: "esc", description: "dismiss" },
];

/** Key instructions for the free-text input with option fallback. */
const TEXT_INSTRUCTIONS: InstructionItem[] = [
  { key: "enter", description: "submit" },
  { key: "esc", description: "back" },
];

/** Key instructions for text-only mode (no options). */
const TEXT_ONLY_INSTRUCTIONS: InstructionItem[] = [
  { key: "enter", description: "submit" },
  { key: "esc", description: "dismiss" },
];

/** Props for AskPrompt. */
export interface AskPromptProps {
  /** The question to display. */
  question: string;
  /** Predefined options. Empty or omitted for free-text only. */
  options?: string[];
  /** Called with the user's answer (selected option or typed text), or null on cancel. */
  onResult: (answer: string | null) => void;
}

/** Manages ask prompt state, mode switching, and result handling. */
function useAskPrompt(props: AskPromptProps) {
  const hasOptions = props.options && props.options.length > 0;
  const [mode, setMode] = useState<"options" | "text">(
    hasOptions ? "options" : "text",
  );
  const [resolved, setResolved] = useState(false);

  /** Handles the result, preventing double-fires. */
  function handleResult(answer: string | null) {
    if (resolved) return;
    setResolved(true);
    props.onResult(answer);
  }

  /** Converts string options to SelectListItems. */
  const selectItems: SelectListItem[] = (props.options ?? []).map((opt) => ({
    key: opt,
    label: opt,
  }));

  /** Handles tab to switch to text mode when in options mode. */
  useInput((_input, key) => {
    if (key.tab && mode === "options" && hasOptions) {
      setMode("text");
    }
  });

  const instructions =
    mode === "text"
      ? hasOptions
        ? TEXT_INSTRUCTIONS
        : TEXT_ONLY_INSTRUCTIONS
      : OPTIONS_INSTRUCTIONS;

  /** Handles escape in text mode — goes back to options or cancels. */
  function handleTextEscape() {
    if (hasOptions) {
      setMode("options");
    } else {
      handleResult(null);
    }
  }

  return {
    mode,
    hasOptions,
    selectItems,
    instructions,
    handleResult,
    handleTextEscape,
  };
}

/** Renders the free-text input mode. */
function TextInput(props: {
  onSubmit: (text: string) => void;
  onEscape: () => void;
}) {
  const [value, setValue] = useState("");
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
    if (key.return && value.trim()) {
      props.onSubmit(value.trim());
      return;
    }
    if (key.escape) {
      props.onEscape();
      return;
    }
    const result = processTextEdit(input, key, value, cursor);
    if (result) {
      if (result.value !== value) setValue(result.value);
      if (result.cursor !== cursor) setCursor(result.cursor);
    }
  });

  const { before, at, after } = splitAtCursor(value, cursor);

  return (
    <Indent>
      <Text color={theme.brand}>{"❯ "}</Text>
      <Text>
        {before}
        <Text inverse>{at}</Text>
        {after}
      </Text>
    </Indent>
  );
}

/** Bordered ask panel with optional predefined choices and free-text input. */
export function AskPrompt(props: AskPromptProps) {
  const {
    mode,
    hasOptions,
    selectItems,
    instructions,
    handleResult,
    handleTextEscape,
  } = useAskPrompt(props);

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Border color={theme.brand} />
      <Indent>
        <Text color={theme.brand}>{props.question}</Text>
      </Indent>
      <Box paddingTop={1}>
        <Box flexDirection="column">
          {mode === "options" && hasOptions ? (
            <SelectList
              items={selectItems}
              onSelect={(item) => handleResult(item.key)}
              onExit={() => handleResult(null)}
              color={theme.brand}
            />
          ) : (
            <TextInput onSubmit={handleResult} onEscape={handleTextEscape} />
          )}
        </Box>
      </Box>
      <Border color={theme.brand} />
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions items={instructions} />
      </Box>
    </Box>
  );
}
