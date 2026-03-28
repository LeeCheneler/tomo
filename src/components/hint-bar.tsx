import { Text } from "ink";

export interface Hint {
  key: string;
  action: string;
}

export interface HintBarProps {
  label?: string;
  hints: Hint[];
}

/** Renders a dim hint bar with shortcut keys highlighted in yellow. */
export function HintBar({ label, hints }: HintBarProps) {
  const parts = hints.map((h, i) => (
    <Text key={h.key} dimColor>
      <Text color="yellow">{h.key}</Text>
      {` ${h.action}`}
      {i < hints.length - 1 ? ", " : ""}
    </Text>
  ));

  return (
    <Text dimColor>
      {"  "}
      {label ? `${label} (` : "("}
      {parts}
      {label ? "):" : ")"}
    </Text>
  );
}
