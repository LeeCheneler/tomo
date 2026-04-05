import { Text, useInput } from "ink";
import { useState } from "react";
import { Indent } from "./layout/indent";
import { theme } from "./theme";

/** A single item in a select list. */
export interface SelectListItem {
  key: string;
  label: string;
}

/** Props for SelectList. */
export interface SelectListProps {
  /** Items to display in the list. */
  items: readonly SelectListItem[];
  /** Called when the user selects an item with Enter. */
  onSelect: (item: SelectListItem) => void;
  /** Called when the user presses Escape. */
  onExit: () => void;
  /** Color for the selected item. Defaults to theme.brand. */
  color?: string;
}

/** Manages cursor position and keyboard input for a select list. */
function useSelectList(props: SelectListProps) {
  const [cursor, setCursor] = useState(0);

  useInput((_input, key) => {
    if (key.escape) {
      props.onExit();
      return;
    }

    if (key.upArrow) {
      const count = props.items.length;
      setCursor((i) => (i - 1 + count) % count);
      return;
    }

    if (key.downArrow) {
      setCursor((i) => (i + 1) % props.items.length);
      return;
    }

    if (key.return) {
      props.onSelect(props.items[cursor]);
      return;
    }
  });

  return { cursor };
}

/** Keyboard-navigable list with cursor indicator. */
export function SelectList(props: SelectListProps) {
  const { cursor } = useSelectList(props);
  const color = props.color ?? theme.brand;

  return (
    <>
      {props.items.map((item, i) => {
        const isSelected = i === cursor;
        return (
          <Indent key={item.key}>
            <Text color={isSelected ? color : undefined}>
              {isSelected ? "❯" : " "} {item.label}
            </Text>
          </Indent>
        );
      })}
    </>
  );
}
