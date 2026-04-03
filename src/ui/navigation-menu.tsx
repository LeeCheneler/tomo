import { Text, useInput } from "ink";
import { useState } from "react";
import { Indent } from "./layout/indent";
import { theme } from "./theme";

/** A single item in a navigation menu. */
export interface NavigationMenuItem {
  key: string;
  label: string;
}

/** Props for NavigationMenu. */
export interface NavigationMenuProps {
  /** Items to display in the menu. */
  items: readonly NavigationMenuItem[];
  /** Called when the user selects an item with Enter. */
  onSelect: (item: NavigationMenuItem) => void;
  /** Called when the user presses Escape. */
  onExit: () => void;
  /** Color for the selected item. Defaults to theme.brand. */
  color?: string;
}

/** Manages cursor position and keyboard input for a navigation menu. */
function useNavigationMenu(props: NavigationMenuProps) {
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
export function NavigationMenu(props: NavigationMenuProps) {
  const { cursor } = useNavigationMenu(props);
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
