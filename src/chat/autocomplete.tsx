import { Box, Text } from "ink";
import { useMemo } from "react";

/** Maximum number of items visible in the autocomplete list. */
const MAX_VISIBLE = 5;

/** A single autocomplete suggestion. */
export interface AutocompleteItem {
  name: string;
  description: string;
}

/** Props for AutocompleteList. */
interface AutocompleteListProps {
  items: readonly AutocompleteItem[];
  filter: string;
  /** Index of the highlighted item, or -1 for no highlight. */
  selectedIndex?: number;
}

/** Filters, sorts, and slices items for display. */
function useFilteredItems(
  items: readonly AutocompleteItem[],
  filter: string,
): readonly AutocompleteItem[] {
  return useMemo(() => {
    const query = filter.toLowerCase();
    return items
      .filter((item) => item.name.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, MAX_VISIBLE);
  }, [items, filter]);
}

/** Filtered command list shown below the input. Optionally highlights a selected item. */
export function AutocompleteList(props: AutocompleteListProps) {
  const filtered = useFilteredItems(props.items, props.filter);

  if (filtered.length === 0) {
    return null;
  }

  const nameWidth = Math.max(...filtered.map((item) => item.name.length + 1));
  const selected = props.selectedIndex ?? -1;

  return (
    <Box flexDirection="column">
      {filtered.map((item, i) => {
        const isSelected = i === selected;
        return (
          <Box key={item.name} gap={2}>
            <Text color={isSelected ? "cyan" : "white"} bold={isSelected}>
              {`/${item.name}`.padEnd(nameWidth)}
            </Text>
            <Text dimColor>{item.description}</Text>
          </Box>
        );
      })}
    </Box>
  );
}
