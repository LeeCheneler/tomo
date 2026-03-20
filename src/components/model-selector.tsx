import { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { ModelInfo } from "../provider/client";
import { fetchModels } from "../provider/client";

interface ModelSelectorProps {
  baseUrl: string;
  activeModel: string;
  onSelect: (model: string) => void;
  onCancel: () => void;
}

/** Interactive model selector with arrow key navigation. */
export function ModelSelector({
  baseUrl,
  activeModel,
  onSelect,
  onCancel,
}: ModelSelectorProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [cursor, setCursor] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchModels(baseUrl)
      .then((result) => {
        setModels(result);
        const activeIndex = result.findIndex((m) => m.id === activeModel);
        if (activeIndex >= 0) setCursor(activeIndex);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => setLoading(false));
  }, [baseUrl, activeModel]);

  useInput((_, key) => {
    if (key.escape) {
      onCancel();
      return;
    }

    if (key.return && models.length > 0) {
      onSelect((models[cursor] as ModelInfo).id);
      return;
    }

    if (key.upArrow) {
      setCursor((c) => (c > 0 ? c - 1 : models.length - 1));
    }
    if (key.downArrow) {
      setCursor((c) => (c < models.length - 1 ? c + 1 : 0));
    }
  });

  if (loading) {
    return <Text dimColor>{"  Fetching models..."}</Text>;
  }

  if (error) {
    return <Text color="red">{`  Failed to fetch models: ${error}`}</Text>;
  }

  if (models.length === 0) {
    return <Text dimColor>{"  No models available."}</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text dimColor>
        {"  Select a model (↑↓ navigate, Enter select, Esc cancel):"}
      </Text>
      {models.map((model, i) => {
        const isCursor = i === cursor;
        const isActive = model.id === activeModel;
        const prefix = isCursor ? "❯" : " ";
        const suffix = isActive ? " (active)" : "";
        return (
          <Text key={model.id} color={isCursor ? "cyan" : undefined}>
            {"  "}
            {prefix} {model.id}
            {suffix}
          </Text>
        );
      })}
    </Box>
  );
}
