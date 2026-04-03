import { Text, useInput } from "ink";
import { useState } from "react";
import { Indent } from "./layout/indent";
import { theme } from "./theme";

/** A single item in a toggle list. */
export interface ToggleListItem {
  key: string;
  label: string;
  value: boolean;
  /** When true, indicates this item has additional options accessible via Tab. */
  hasOptions?: boolean;
}

/** Props for ToggleList. */
export interface ToggleListProps {
  /** Items to display with toggleable values. */
  items: readonly ToggleListItem[];
  /** Called when the user toggles an item. Receives the key and new boolean value. */
  onToggle: (key: string, value: boolean) => void;
  /** Called when the user presses Escape. */
  onExit: () => void;
  /** Called when the user presses Tab on an item with hasOptions. */
  onOptions?: (key: string) => void;
  /** Color for the selected item and enabled indicators. Defaults to theme.brand. */
  color?: string;
}

/** Manages cursor position and keyboard input for a toggle list. */
function useToggleList(props: ToggleListProps) {
  const [cursor, setCursor] = useState(0);

  useInput((input, key) => {
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

    if (key.tab && props.onOptions) {
      const item = props.items[cursor];
      if (item.hasOptions) {
        props.onOptions(item.key);
      }
      return;
    }

    if (key.return || input === " ") {
      const item = props.items[cursor];
      props.onToggle(item.key, !item.value);
      return;
    }
  });

  return { cursor };
}

/** Keyboard-navigable list of boolean toggles with cursor indicator. */
export function ToggleList(props: ToggleListProps) {
  const { cursor } = useToggleList(props);
  const color = props.color ?? theme.brand;

  return (
    <>
      {props.items.map((item, i) => {
        const isSelected = i === cursor;
        return (
          <Indent key={item.key}>
            <Text color={isSelected ? color : undefined}>
              {isSelected ? "❯" : " "}{" "}
            </Text>
            <Text dimColor>[</Text>
            {item.value ? (
              <Text color={theme.success}>✓</Text>
            ) : (
              <Text dimColor> </Text>
            )}
            <Text dimColor>]</Text>
            <Text color={isSelected ? color : undefined}> {item.label}</Text>
            {item.hasOptions && <Text color={theme.key}> ›</Text>}
          </Indent>
        );
      })}
    </>
  );
}
