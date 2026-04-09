import { Text } from "ink";
import { theme } from "./theme";

/** A single instruction item showing a key and its action. */
export interface InstructionItem {
  key: string;
  description: string;
}

/** Props for KeyInstructions. */
interface KeyInstructionsProps {
  items: InstructionItem[];
}

/** Renders a row of key–description pairs, yellow key followed by dim description. */
export function KeyInstructions(props: KeyInstructionsProps) {
  if (props.items.length === 0) {
    return null;
  }

  return (
    <Text>
      {props.items.map((item, i) => (
        <Text key={item.key}>
          {i > 0 && <Text dimColor> · </Text>}
          <Text color={theme.key}>{item.key}</Text>
          <Text dimColor> {item.description}</Text>
        </Text>
      ))}
    </Text>
  );
}
