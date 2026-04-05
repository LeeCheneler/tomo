import { Box, Text, useInput } from "ink";
import type { CommandContext, TakeoverDone } from "../commands/registry";
import { Border } from "../ui/border";
import type { InstructionItem } from "../ui/key-instructions";
import { KeyInstructions } from "../ui/key-instructions";
import { Indent } from "../ui/layout/indent";
import { SelectList } from "../ui/select-list";
import type { SelectListItem } from "../ui/select-list";
import { theme } from "../ui/theme";
import type { SessionSummary } from "./session";
import { listSessions } from "./session";

/** Max length for the first message preview. */
const MAX_PREVIEW_LENGTH = 50;

/** Key instructions for the session list. */
const INSTRUCTIONS: InstructionItem[] = [
  { key: "up/down", description: "navigate" },
  { key: "enter", description: "select" },
  { key: "esc", description: "back" },
];

/** Intl formatter for "dd MMM yyyy, HH:mm". */
const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Formats a Date for display in the session list. */
function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

/** Truncates a string to maxLength, appending "..." if truncated. */
function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

/** Builds a select list item label from a session summary. */
function buildLabel(session: SessionSummary): string {
  const date = formatDate(session.date);
  const preview = session.firstMessage
    ? truncate(session.firstMessage, MAX_PREVIEW_LENGTH)
    : "(empty session)";
  return `${date}  ${preview}`;
}

/** Builds select list items from session summaries. */
function buildItems(sessions: SessionSummary[]): SelectListItem[] {
  return sessions.map((s) => ({ key: s.path, label: buildLabel(s) }));
}

/** Props for SessionList. */
export interface SessionListProps {
  onDone: TakeoverDone;
  context: CommandContext;
}

/** Takeover screen that lists saved sessions. */
export function SessionList(props: SessionListProps) {
  const sessions = listSessions();

  if (sessions.length === 0) {
    return <EmptySessionList onBack={props.onDone} />;
  }

  const items = buildItems(sessions);

  /** Loads the selected session and exits the takeover. */
  function handleSelect(item: SelectListItem) {
    props.context.loadSession(item.key);
    props.onDone();
  }

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Border color={theme.brand} />
      <Indent>
        <Text bold>Sessions</Text>
      </Indent>
      <SelectList
        items={items}
        onSelect={handleSelect}
        onExit={props.onDone}
        color={theme.brand}
      />
      <Border color={theme.brand} />
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions items={INSTRUCTIONS} />
      </Box>
    </Box>
  );
}

/** Props for EmptySessionList. */
interface EmptySessionListProps {
  onBack: () => void;
}

/** Shown when no saved sessions exist. */
function EmptySessionList(props: EmptySessionListProps) {
  useInput((_input, key) => {
    if (key.escape) {
      props.onBack();
    }
  });

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Border color={theme.brand} />
      <Indent>
        <Text bold>Sessions</Text>
      </Indent>
      <Indent>
        <Text dimColor>No saved sessions.</Text>
      </Indent>
      <Border color={theme.brand} />
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions items={[{ key: "esc", description: "back" }]} />
      </Box>
    </Box>
  );
}
