import { Box, Text, useInput } from "ink";
import { useState } from "react";
import { useListNavigation } from "../hooks/use-list-navigation";
import type { Session } from "../session";
import { listSessions } from "../session";

const WINDOW_SIZE = 5;
const MAX_PREVIEW_LENGTH = 50;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = MONTHS[d.getMonth()];
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${hours}:${minutes}`;
}

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function sessionLabel(session: Session): string {
  const date = formatDate(session.createdAt);
  const preview = session.messages[0]
    ? truncate(session.messages[0].content, MAX_PREVIEW_LENGTH)
    : "(empty)";
  return `${date} - ${preview}`;
}

interface SessionSelectorProps {
  onSelect: (id: string) => void;
  onCancel: () => void;
}

/** Interactive session picker with arrow key navigation and a sliding window. */
export function SessionSelector({ onSelect, onCancel }: SessionSelectorProps) {
  const [sessions] = useState<Session[]>(() => listSessions(50));
  const { cursor, windowStart, handleUp, handleDown } = useListNavigation(
    sessions.length,
    { maxVisible: WINDOW_SIZE, wrap: false },
  );

  useInput((_, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.return && sessions.length > 0) {
      onSelect(sessions[cursor].id);
      return;
    }

    if (key.upArrow) handleUp();
    if (key.downArrow) handleDown();
  });

  if (sessions.length === 0) {
    return <Text dimColor>{"  No previous sessions."}</Text>;
  }

  const visible = sessions.slice(windowStart, windowStart + WINDOW_SIZE);

  return (
    <Box flexDirection="column">
      <Text dimColor>
        {
          "  Select a session (\u2191\u2193 navigate, Enter select, Esc cancel):"
        }
      </Text>
      {visible.map((session, i) => {
        const actualIndex = windowStart + i;
        const isCursor = actualIndex === cursor;
        const prefix = isCursor ? "\u276F" : " ";
        return (
          <Text key={session.id} color={isCursor ? "cyan" : undefined}>
            {"  "}
            {prefix} {sessionLabel(session)}
          </Text>
        );
      })}
    </Box>
  );
}
