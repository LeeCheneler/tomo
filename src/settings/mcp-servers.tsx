import { Box, Text } from "ink";
import { useState } from "react";
import { z } from "zod";
import { useConfig } from "../config/hook";
import type { McpConnection } from "../config/schema";
import {
  addMcpConnection,
  removeMcpConnection,
  updateMcpConnection,
} from "../config/updaters";
import { Border } from "../ui/border";
import type { EditableListItem } from "../ui/editable-list";
import { EditableList } from "../ui/editable-list";
import type { FormField, FormValues } from "../ui/form";
import { Form } from "../ui/form";
import { KeyInstructions } from "../ui/key-instructions";
import { KvEditor } from "../ui/kv-editor";
import { Indent } from "../ui/layout/indent";
import type { SelectListItem } from "../ui/select-list";
import { SelectList } from "../ui/select-list";
import { theme } from "../ui/theme";

/** Internal step state for the screen. */
type Step = "list" | "transport-pick" | "options" | "kv-editor";

/** Transport options shown on the transport-pick step. */
const TRANSPORT_ITEMS: readonly SelectListItem[] = [
  { key: "stdio", label: "stdio (subprocess)" },
  { key: "http", label: "http (remote URL)" },
];

/** Schema for narrowing FormValues entries to a string. */
const stringValueSchema = z.string();
/** Schema for narrowing FormValues entries to a string→string record. */
const recordValueSchema = z.record(z.string(), z.string());

/** Joins args with single spaces for the form text input. */
function argsToString(args: readonly string[]): string {
  return args.join(" ");
}

/** Splits a space-separated args string into an array, dropping empty entries. */
function stringToArgs(input: string): string[] {
  return input.trim().split(/\s+/).filter(Boolean);
}

/** Converts an MCP connection into form values for the options form. */
function connectionToFormValues(connection: McpConnection): FormValues {
  if (connection.transport === "stdio") {
    return {
      command: connection.command,
      args: argsToString(connection.args),
      env: connection.env ?? {},
    };
  }
  return {
    url: connection.url,
    headers: connection.headers ?? {},
  };
}

/** Converts form values back into a typed MCP connection. */
function formValuesToConnection(
  transport: "stdio" | "http",
  values: FormValues,
): McpConnection {
  if (transport === "stdio") {
    return {
      transport: "stdio",
      command: stringValueSchema.parse(values.command),
      args: stringToArgs(stringValueSchema.parse(values.args)),
      env: recordValueSchema.parse(values.env),
      enabled: true,
    };
  }
  return {
    transport: "http",
    url: stringValueSchema.parse(values.url),
    headers: recordValueSchema.parse(values.headers),
    enabled: true,
  };
}

/** Builds form fields for the given transport and current values. */
function buildFormFields(
  transport: "stdio" | "http",
  values: FormValues,
): FormField[] {
  if (transport === "stdio") {
    return [
      {
        type: "text",
        key: "command",
        label: "Command",
        initialValue: stringValueSchema.parse(values.command),
      },
      {
        type: "text",
        key: "args",
        label: "Args",
        initialValue: stringValueSchema.parse(values.args),
      },
      {
        type: "kv",
        key: "env",
        label: "Env",
        initialValue: recordValueSchema.parse(values.env),
      },
    ];
  }
  return [
    {
      type: "text",
      key: "url",
      label: "URL",
      initialValue: stringValueSchema.parse(values.url),
    },
    {
      type: "kv",
      key: "headers",
      label: "Headers",
      initialValue: recordValueSchema.parse(values.headers),
    },
  ];
}

/** Builds default form values for a freshly-created connection of a transport. */
function defaultConnection(transport: "stdio" | "http"): McpConnection {
  if (transport === "stdio") {
    return {
      transport: "stdio",
      command: "",
      args: [],
      enabled: true,
    };
  }
  return {
    transport: "http",
    url: "",
    enabled: true,
  };
}

/** Builds editable list items from the connections record. */
function buildItems(
  connections: Record<string, McpConnection>,
): EditableListItem[] {
  return Object.keys(connections).map((name) => ({
    value: name,
    hasOptions: true,
  }));
}

/** Props for McpServersScreen. */
export interface McpServersScreenProps {
  onBack: () => void;
}

/** Manages MCP connections list state, persistence, and step routing. */
function useMcpServersScreen(props: McpServersScreenProps) {
  const { config, reload } = useConfig();
  const [connections, setConnections] = useState<Record<string, McpConnection>>(
    () => config.mcp.connections,
  );
  const [step, setStep] = useState<Step>("list");
  const [editingName, setEditingName] = useState<string | null>(null);
  const [editingTransport, setEditingTransport] = useState<
    "stdio" | "http" | null
  >(null);
  const [formValues, setFormValues] = useState<FormValues | null>(null);
  const [formMountKey, setFormMountKey] = useState(0);
  const [kvFieldKey, setKvFieldKey] = useState<string | null>(null);
  const [enterAction, setEnterAction] = useState<"save" | "remove">("save");

  /** Resets all editing state and returns to the list. */
  function returnToList() {
    setStep("list");
    setEditingName(null);
    setEditingTransport(null);
    setFormValues(null);
    setKvFieldKey(null);
    setFormMountKey(0);
  }

  /** Begins adding a new connection — collects the name then routes to transport pick. */
  function handleAdd(name: string) {
    setEditingName(name);
    setStep("transport-pick");
  }

  /** Removes a connection by index. */
  function handleRemove(index: number) {
    const names = Object.keys(connections);
    const name = names[index];
    removeMcpConnection(name);
    reload();
    setConnections((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  /** Renames a connection by index. */
  function handleRename(index: number, newName: string) {
    const names = Object.keys(connections);
    const oldName = names[index];
    const connection = connections[oldName];
    updateMcpConnection(oldName, newName, connection);
    reload();
    setConnections((prev) => {
      const next: Record<string, McpConnection> = {};
      for (const [key, value] of Object.entries(prev)) {
        next[key === oldName ? newName : key] = value;
      }
      return next;
    });
  }

  /** Opens the options form for an existing connection. */
  function handleOptions(index: number) {
    const names = Object.keys(connections);
    const name = names[index];
    const connection = connections[name];
    setEditingName(name);
    setEditingTransport(connection.transport);
    setFormValues(connectionToFormValues(connection));
    setFormMountKey(0);
    setStep("options");
  }

  /** Picks a transport and opens the options form. The connection is held in memory only until form submit. */
  function handleTransportSelect(item: SelectListItem) {
    /* v8 ignore next -- editingName is always set when reaching transport-pick */
    if (!editingName) return;
    const transport: "stdio" | "http" = item.key === "http" ? "http" : "stdio";
    setEditingTransport(transport);
    setFormValues(connectionToFormValues(defaultConnection(transport)));
    setFormMountKey(0);
    setStep("options");
  }

  /** Cancels transport pick and returns to the list. */
  function handleTransportCancel() {
    returnToList();
  }

  /** Persists the form values to config — adds for new connections, updates for existing. */
  function handleFormSubmit(values: FormValues) {
    /* v8 ignore next 2 -- guards against impossible state */
    if (!editingName || !editingTransport) return;
    const connection = formValuesToConnection(editingTransport, values);
    const isNew = !(editingName in connections);
    if (isNew) {
      addMcpConnection(editingName, connection);
    } else {
      updateMcpConnection(editingName, editingName, connection);
    }
    reload();
    setConnections((prev) => ({ ...prev, [editingName]: connection }));
    returnToList();
  }

  /** Cancels the options form and returns to the list. */
  function handleFormCancel() {
    returnToList();
  }

  /** Stashes form values and routes to the kv editor for the named field. */
  function handleOpenField(key: string, values: FormValues) {
    setFormValues(values);
    setKvFieldKey(key);
    setStep("kv-editor");
  }

  /** Merges the kv editor's result into the form stash and remounts the form. */
  function handleKvExit(entries: Record<string, string>) {
    setFormValues((prev) =>
      /* v8 ignore next -- prev is always set when in kv-editor step */
      prev && kvFieldKey ? { ...prev, [kvFieldKey]: entries } : prev,
    );
    setKvFieldKey(null);
    setFormMountKey((k) => k + 1);
    setStep("options");
  }

  return {
    connections,
    items: buildItems(connections),
    step,
    editingName,
    editingTransport,
    formValues,
    formMountKey,
    kvFieldKey,
    enterAction,
    setEnterAction,
    handleAdd,
    handleRemove,
    handleRename,
    handleOptions,
    handleTransportSelect,
    handleTransportCancel,
    handleFormSubmit,
    handleFormCancel,
    handleOpenField,
    handleKvExit,
    handleBack: props.onBack,
  };
}

/** Settings sub-screen for managing MCP server connections. */
export function McpServersScreen(props: McpServersScreenProps) {
  const {
    items,
    step,
    editingName,
    editingTransport,
    formValues,
    formMountKey,
    kvFieldKey,
    enterAction,
    setEnterAction,
    handleAdd,
    handleRemove,
    handleRename,
    handleOptions,
    handleTransportSelect,
    handleTransportCancel,
    handleFormSubmit,
    handleFormCancel,
    handleOpenField,
    handleKvExit,
    handleBack,
  } = useMcpServersScreen(props);

  if (step === "transport-pick") {
    return (
      <Box flexDirection="column" paddingTop={1}>
        <Border color={theme.settings} />
        <Indent>
          <Text bold>{editingName} — Transport</Text>
        </Indent>
        <Indent>
          <Text dimColor>Choose how this MCP server is reached</Text>
        </Indent>
        <SelectList
          items={TRANSPORT_ITEMS}
          onSelect={handleTransportSelect}
          onExit={handleTransportCancel}
          color={theme.settings}
        />
        <Border color={theme.settings} />
        <Box justifyContent="flex-end" height={1}>
          <KeyInstructions
            items={[
              { key: "enter", description: "select" },
              { key: "esc", description: "cancel" },
            ]}
          />
        </Box>
      </Box>
    );
  }

  if (step === "kv-editor" && formValues && kvFieldKey) {
    const entries = recordValueSchema.parse(formValues[kvFieldKey]);
    const label = kvFieldKey === "env" ? "Env" : "Headers";
    const placeholder =
      kvFieldKey === "env" ? "KEY=value" : "Header-Name=value";
    return (
      <Box flexDirection="column" paddingTop={1}>
        <Border color={theme.settings} />
        <Indent>
          <Text bold>
            {editingName} — {label}
          </Text>
        </Indent>
        <Indent>
          <Text dimColor>
            One KEY=value per line. Clear and enter to remove.
          </Text>
        </Indent>
        <KvEditor
          entries={entries}
          onExit={handleKvExit}
          color={theme.settings}
          placeholder={placeholder}
        />
        <Border color={theme.settings} />
        <Box justifyContent="flex-end" height={1}>
          <KeyInstructions
            items={[
              { key: "enter", description: "save row" },
              { key: "esc", description: "back" },
            ]}
          />
        </Box>
      </Box>
    );
  }

  if (step === "options" && editingTransport && formValues) {
    const fields = buildFormFields(editingTransport, formValues);
    return (
      <Box flexDirection="column" paddingTop={1}>
        <Border color={theme.settings} />
        <Indent>
          <Text bold>
            {editingName} ({editingTransport})
          </Text>
        </Indent>
        <Form
          key={formMountKey}
          fields={fields}
          onSubmit={handleFormSubmit}
          onCancel={handleFormCancel}
          onOpenField={handleOpenField}
          color={theme.settings}
        />
        <Border color={theme.settings} />
        <Box justifyContent="flex-end" height={1}>
          <KeyInstructions
            items={[
              { key: "enter", description: "save" },
              { key: "tab", description: "edit" },
              { key: "esc", description: "cancel" },
            ]}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Border color={theme.settings} />
      <Indent>
        <Text bold>MCP Servers</Text>
      </Indent>
      <Indent>
        <Text dimColor>Clear text and press enter to remove</Text>
      </Indent>
      <EditableList
        items={items}
        onAdd={handleAdd}
        onRemove={handleRemove}
        onUpdate={handleRename}
        onOptions={handleOptions}
        onExit={handleBack}
        onEnterActionChange={setEnterAction}
        color={theme.settings}
        placeholder="Add server..."
      />
      <Border color={theme.settings} />
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions
          items={[
            { key: "enter", description: enterAction },
            { key: "tab", description: "options" },
            { key: "esc", description: "back" },
          ]}
        />
      </Box>
    </Box>
  );
}
