import { Box, Text, useInput } from "ink";
import type { TakeoverDone } from "../commands/registry";
import { Border } from "../ui/border";
import type { InstructionItem } from "../ui/key-instructions";
import { KeyInstructions } from "../ui/key-instructions";
import { Indent } from "../ui/layout/indent";
import { theme } from "../ui/theme";

/** Key instructions for the model selector. */
const INSTRUCTIONS: InstructionItem[] = [{ key: "esc", description: "back" }];

/** Props for ModelSelector. */
export interface ModelSelectorProps {
  onDone: TakeoverDone;
}

/** Manages model selector state. */
function useModelSelector(props: ModelSelectorProps) {
  useInput((_input, key) => {
    if (key.escape) {
      props.onDone();
    }
  });
}

/** Takeover screen for selecting a provider and model. */
export function ModelSelector(props: ModelSelectorProps) {
  useModelSelector(props);

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Border color={theme.brand} />
      <Indent>
        <Text bold>Select Model</Text>
      </Indent>
      <Border color={theme.brand} />
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions items={INSTRUCTIONS} />
      </Box>
    </Box>
  );
}
