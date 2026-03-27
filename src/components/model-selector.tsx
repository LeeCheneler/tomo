import { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { ModelInfo } from "../provider/client";
import { fetchModels, resolveApiKey } from "../provider/client";
import { useListNavigation } from "../hooks/use-list-navigation";

interface ProviderEntry {
  name: string;
  baseUrl: string;
  type: string;
  apiKey?: string;
}

type Row =
  | { kind: "header"; provider: string }
  | { kind: "model"; provider: string; model: string };

interface ProviderResult {
  provider: string;
  models: ModelInfo[];
  error: string | null;
}

interface ModelSelectorProps {
  providers: ProviderEntry[];
  activeProvider: string;
  activeModel: string;
  onSelect: (provider: string, model: string) => void;
  onCancel: () => void;
}

/** Interactive model selector with arrow key navigation, grouped by provider. */
export function ModelSelector({
  providers,
  activeProvider,
  activeModel,
  onSelect,
  onCancel,
}: ModelSelectorProps) {
  const [results, setResults] = useState<ProviderResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all(
      providers.map(async (p) => {
        try {
          const key = resolveApiKey(p.type, p.apiKey);
          const models = await fetchModels(p.baseUrl, key, p.type);
          return { provider: p.name, models, error: null };
        } catch (err) {
          return {
            provider: p.name,
            models: [],
            error: err instanceof Error ? err.message : String(err),
          };
        }
      }),
    ).then((all) => {
      setResults(all);
      setLoading(false);
    });
  }, [providers]);

  // Build flat row list from results
  const rows: Row[] = [];
  for (const r of results) {
    rows.push({ kind: "header", provider: r.provider });
    for (const m of r.models) {
      rows.push({ kind: "model", provider: r.provider, model: m.id });
    }
  }

  // Selectable indices (model rows only)
  const selectableIndices = rows
    .map((r, i) => (r.kind === "model" ? i : -1))
    .filter((i) => i >= 0);

  const MAX_VISIBLE = 5;
  const [initialised, setInitialised] = useState(false);
  const [filter, setFilter] = useState("");

  // Filter selectable indices by search term
  const filteredIndices = filter
    ? selectableIndices.filter((idx) => {
        const row = rows[idx];
        return (
          row?.kind === "model" &&
          row.model.toLowerCase().includes(filter.toLowerCase())
        );
      })
    : selectableIndices;

  const { cursor, setCursor, windowStart, handleUp, handleDown } =
    useListNavigation(filteredIndices.length, { maxVisible: MAX_VISIBLE });

  // Set cursor to active model once results arrive
  // biome-ignore lint/correctness/useExhaustiveDependencies: only trigger on load completion
  useEffect(() => {
    if (!loading && !initialised && filteredIndices.length > 0) {
      const initial = filteredIndices.findIndex((idx) => {
        const row = rows[idx];
        return (
          row?.kind === "model" &&
          row.provider === activeProvider &&
          row.model === activeModel
        );
      });
      setCursor(initial >= 0 ? initial : 0);
      setInitialised(true);
    }
  }, [loading, initialised, filteredIndices.length]);

  useInput((input, key) => {
    if (key.escape) {
      if (filter) {
        setFilter("");
        setCursor(0);
        return;
      }
      onCancel();
      return;
    }

    if (key.return && filteredIndices.length > 0) {
      const idx = filteredIndices[cursor];
      if (idx === undefined) return;
      const row = rows[idx];
      if (row?.kind === "model") {
        onSelect(row.provider, row.model);
      }
      return;
    }

    if (key.upArrow) {
      handleUp();
      return;
    }
    if (key.downArrow) {
      handleDown();
      return;
    }

    if (key.backspace || key.delete) {
      setFilter((f) => {
        setCursor(0);
        return f.slice(0, -1);
      });
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      setFilter((f) => {
        setCursor(0);
        return f + input;
      });
    }
  });

  if (loading) {
    return <Text dimColor>{"  Fetching models..."}</Text>;
  }

  if (selectableIndices.length === 0) {
    return <Text dimColor>{"  No models available."}</Text>;
  }

  // Visible window of filtered model rows
  const visibleSelectables = filteredIndices.slice(
    windowStart,
    windowStart + MAX_VISIBLE,
  );
  const remaining = filteredIndices.length - MAX_VISIBLE;

  return (
    <Box flexDirection="column">
      <Text dimColor>
        {
          "  Select a model (↑↓ navigate, type to filter, Enter select, Esc cancel):"
        }
      </Text>
      <Text> </Text>
      <Text>
        {"  Search: "}
        {filter}
        <Text dimColor>█</Text>
        {filter && (
          <Text dimColor>
            {` (${filteredIndices.length} of ${selectableIndices.length})`}
          </Text>
        )}
      </Text>
      <Text> </Text>
      {filteredIndices.length === 0 && (
        <Text dimColor>{"    No models match your search."}</Text>
      )}
      {visibleSelectables.map((rowIdx) => {
        const row = rows[rowIdx];
        if (!row || row.kind !== "model") return null;

        // Show provider header before the first model of each provider in the window
        const prevVisible =
          visibleSelectables[visibleSelectables.indexOf(rowIdx) - 1];
        const prevRow = prevVisible !== undefined ? rows[prevVisible] : null;
        const showHeader =
          !prevRow ||
          (prevRow.kind === "model" && prevRow.provider !== row.provider);

        const providerResult = results.find((r) => r.provider === row.provider);

        const isCursor = filteredIndices.indexOf(rowIdx) === cursor;
        const isActive =
          row.provider === activeProvider && row.model === activeModel;
        const prefix = isCursor ? "❯" : " ";
        const suffix = isActive ? " (active)" : "";

        return (
          <Box key={`${row.provider}-${row.model}`} flexDirection="column">
            {showHeader && (
              <Text dimColor bold>
                {"  "}
                {row.provider}
                {providerResult?.error
                  ? ` (error: ${providerResult.error})`
                  : ""}
              </Text>
            )}
            <Text color={isCursor ? "cyan" : undefined}>
              {"    "}
              {prefix} {row.model}
              {suffix}
            </Text>
          </Box>
        );
      })}
      {remaining > 0 && (
        <Text dimColor>
          {"    "}
          {`${remaining} more...`}
        </Text>
      )}
    </Box>
  );
}
