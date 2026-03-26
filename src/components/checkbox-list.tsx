import { Box, Text } from "ink";

export interface CheckboxItem {
  /** Unique key for React rendering. */
  key: string;
  /** Display label shown in brand colour. */
  label: string;
  /** Description shown as dimmed brand colour. Sentence case. */
  description?: string;
  /** Whether the item is checked. */
  checked: boolean;
  /** Optional warning shown below the item when checked. */
  warning?: string;
}

interface CheckboxListProps {
  items: CheckboxItem[];
  cursor: number;
}

/** Reusable checkbox list with consistent styling: green tick, brand-colour label, dim description. */
export function CheckboxList({ items, cursor }: CheckboxListProps) {
  const maxLabel = Math.max(...items.map((item) => item.label.length));

  return (
    <Box flexDirection="column">
      {items.map((item, i) => {
        const isCurrent = i === cursor;
        return (
          <Box key={item.key} flexDirection="column">
            <Text>
              {"    "}
              <Text color={isCurrent ? "cyan" : undefined}>
                {isCurrent ? "❯" : " "}
              </Text>{" "}
              {item.checked ? (
                <Text color="green">[✔]</Text>
              ) : (
                <Text dimColor>[ ]</Text>
              )}{" "}
              <Text color="cyan">{item.label.padEnd(maxLabel)}</Text>
              {item.description && (
                <Text color="cyan" dimColor>
                  {"  "}
                  {item.description}
                </Text>
              )}
            </Text>
            {item.warning && (
              <Text color="yellow">
                {"        ⚠ "}
                {item.warning}
              </Text>
            )}
          </Box>
        );
      })}
    </Box>
  );
}
