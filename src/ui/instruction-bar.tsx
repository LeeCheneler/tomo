import { Text } from "ink";

/** A single instruction item showing a key and its action. */
export interface InstructionItem {
  key: string;
  description: string;
}

/** Props for InstructionBar. */
interface InstructionBarProps {
  items: InstructionItem[];
}

/** Renders a row of key–description pairs, yellow key followed by dim description. */
export function InstructionBar(props: InstructionBarProps) {
  if (props.items.length === 0) {
    return null;
  }

  return (
    <Text>
      {props.items.map((item, i) => (
        <Text key={item.key}>
          {i > 0 && <Text dimColor> · </Text>}
          <Text color="yellow">{item.key}</Text>
          <Text dimColor> {item.description}</Text>
        </Text>
      ))}
    </Text>
  );
}
