import { Box, useInput } from "ink";
import { useState } from "react";
import { Border } from "./border";
import type { InstructionItem } from "./key-instructions";
import { KeyInstructions } from "./key-instructions";
import { SelectList } from "./select-list";
import type { SelectListItem } from "./select-list";
import { theme } from "./theme";

/** Key instructions for the approval panel. */
const INSTRUCTIONS: InstructionItem[] = [
  { key: "y", description: "approve" },
  { key: "n", description: "deny" },
  { key: "enter", description: "select" },
];

/** Select list items for the approval panel. */
const ITEMS: readonly SelectListItem[] = [
  { key: "approve", label: "Approve" },
  { key: "deny", label: "Deny" },
];

/** Props for ConfirmPrompt. */
export interface ConfirmPromptProps {
  /** Called with true for approve, false for deny. */
  onResult: (approved: boolean) => void;
}

/** Bordered approval panel with select list and y/n keyboard shortcuts. */
export function ConfirmPrompt(props: ConfirmPromptProps) {
  const [resolved, setResolved] = useState(false);

  /** Handles the result, preventing double-fires. */
  function handleResult(approved: boolean) {
    if (resolved) return;
    setResolved(true);
    props.onResult(approved);
  }

  useInput((input) => {
    if (input.toLowerCase() === "y") {
      handleResult(true);
    }
    if (input.toLowerCase() === "n") {
      handleResult(false);
    }
  });

  /** Handles select list selection. */
  function handleSelect(item: SelectListItem) {
    handleResult(item.key === "approve");
  }

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Border color={theme.warning} />
      <SelectList
        items={ITEMS}
        onSelect={handleSelect}
        onExit={() => handleResult(false)}
        color={theme.warning}
      />
      <Border color={theme.warning} />
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions items={INSTRUCTIONS} />
      </Box>
    </Box>
  );
}
