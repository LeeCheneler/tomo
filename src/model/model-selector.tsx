import { Box, Text, useInput } from "ink";
import { useEffect, useState } from "react";
import type { TakeoverDone } from "../commands/registry";
import { useConfig } from "../config/hook";
import type { Provider } from "../config/schema";
import { updateActiveModel, updateActiveProvider } from "../config/updaters";
import type { ModelInfo } from "../provider/client";
import { createOpenAICompatibleClient } from "../provider/openai-compatible";
import { Border } from "../ui/border";
import type { InstructionItem } from "../ui/key-instructions";
import { KeyInstructions } from "../ui/key-instructions";
import { Indent } from "../ui/layout/indent";
import { LoadingIndicator } from "../ui/loading-indicator";
import type { NavigationMenuItem } from "../ui/navigation-menu";
import { NavigationMenu } from "../ui/navigation-menu";
import { theme } from "../ui/theme";

/** Key instructions for the provider list. */
const PROVIDER_INSTRUCTIONS: InstructionItem[] = [
  { key: "up/down", description: "navigate" },
  { key: "enter", description: "select" },
  { key: "esc", description: "back" },
];

/** Props for ModelSelector. */
export interface ModelSelectorProps {
  onDone: TakeoverDone;
}

/** Internal step state. */
type Step = { kind: "providers" } | { kind: "models"; provider: Provider };

/** Builds navigation menu items from providers. */
function buildProviderItems(
  providers: Provider[],
): readonly NavigationMenuItem[] {
  return providers.map((p) => ({ key: p.name, label: p.name }));
}

/** Manages model selector step routing. */
function useModelSelector(props: ModelSelectorProps) {
  const config = useConfig();
  const [providers] = useState<Provider[]>(() => config.providers);
  const [step, setStep] = useState<Step>({ kind: "providers" });

  /** Selects a provider and moves to the model list. */
  function handleSelectProvider(item: NavigationMenuItem) {
    const provider = providers.find((p) => p.name === item.key);
    /* v8 ignore next -- provider always exists since items come from providers */
    if (!provider) return;
    setStep({ kind: "models", provider });
  }

  /** Returns to the provider list from the model list. */
  function handleBackToProviders() {
    setStep({ kind: "providers" });
  }

  /** Selects a model, updates config, and closes the takeover. */
  function handleSelectModel(provider: Provider, model: string) {
    updateActiveProvider(provider.name);
    updateActiveModel(model);
    props.onDone(`Model set to ${model} (${provider.name})`);
  }

  return {
    providers,
    providerItems: buildProviderItems(providers),
    step,
    handleSelectProvider,
    handleSelectModel,
    handleBackToProviders,
    handleExit: props.onDone,
  };
}

/** Takeover screen for selecting a provider and model. */
export function ModelSelector(props: ModelSelectorProps) {
  const {
    providers,
    providerItems,
    step,
    handleSelectProvider,
    handleSelectModel,
    handleBackToProviders,
    handleExit,
  } = useModelSelector(props);

  if (step.kind === "models") {
    return (
      <ModelList
        provider={step.provider}
        onSelect={handleSelectModel}
        onBack={handleBackToProviders}
      />
    );
  }

  if (providers.length === 0) {
    return <NoProvidersMessage onBack={handleExit} />;
  }

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Border color={theme.brand} />
      <Indent>
        <Text bold>Select Model</Text>
      </Indent>
      <NavigationMenu
        items={providerItems}
        onSelect={handleSelectProvider}
        onExit={handleExit}
        color={theme.brand}
      />
      <Border color={theme.brand} />
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions items={PROVIDER_INSTRUCTIONS} />
      </Box>
    </Box>
  );
}

/** Props for NoProvidersMessage. */
interface NoProvidersMessageProps {
  onBack: () => void;
}

/** Shown when no providers are configured. */
function NoProvidersMessage(props: NoProvidersMessageProps) {
  useInput((_input, key) => {
    if (key.escape) {
      props.onBack();
    }
  });

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Border color={theme.brand} />
      <Indent>
        <Text bold>Select Model</Text>
      </Indent>
      <Indent>
        <Text dimColor>No providers configured. Use /settings to add one.</Text>
      </Indent>
      <Border color={theme.brand} />
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions items={[{ key: "esc", description: "back" }]} />
      </Box>
    </Box>
  );
}

/** Model fetch state. */
type ModelFetchState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded"; models: ModelInfo[] };

/** Key instructions for the model list. */
const MODEL_INSTRUCTIONS: InstructionItem[] = [
  { key: "up/down", description: "navigate" },
  { key: "enter", description: "select" },
  { key: "esc", description: "back" },
];

/** Props for ModelList. */
interface ModelListProps {
  provider: Provider;
  onSelect: (provider: Provider, model: string) => void;
  onBack: () => void;
}

/** Fetches and displays models for a provider. */
function ModelList(props: ModelListProps) {
  const [state, setState] = useState<ModelFetchState>({ status: "loading" });

  useEffect(() => {
    const client = createOpenAICompatibleClient(props.provider);
    client
      .fetchModels()
      .then((models) => {
        setState({ status: "loaded", models });
      })
      .catch((err: Error) => {
        setState({ status: "error", message: err.message });
      });
  }, [props.provider]);

  if (state.status === "loading") {
    return (
      <Box flexDirection="column" paddingTop={1}>
        <Border color={theme.brand} />
        <Indent>
          <Text bold>Select Model — {props.provider.name}</Text>
        </Indent>
        <Indent>
          <LoadingIndicator text="Loading models" />
        </Indent>
        <Border color={theme.brand} />
        <Box justifyContent="flex-end" height={1}>
          <KeyInstructions items={[{ key: "esc", description: "back" }]} />
        </Box>
      </Box>
    );
  }

  if (state.status === "error") {
    return (
      <ModelListError
        provider={props.provider}
        message={state.message}
        onBack={props.onBack}
      />
    );
  }

  if (state.models.length === 0) {
    return <ModelListEmpty provider={props.provider} onBack={props.onBack} />;
  }

  const items: NavigationMenuItem[] = state.models.map((m) => ({
    key: m.id,
    label: m.id,
  }));

  /** Handles model selection. */
  function handleSelect(item: NavigationMenuItem) {
    props.onSelect(props.provider, item.key);
  }

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Border color={theme.brand} />
      <Indent>
        <Text bold>Select Model — {props.provider.name}</Text>
      </Indent>
      <NavigationMenu
        items={items}
        onSelect={handleSelect}
        onExit={props.onBack}
        color={theme.brand}
      />
      <Border color={theme.brand} />
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions items={MODEL_INSTRUCTIONS} />
      </Box>
    </Box>
  );
}

/** Props for ModelListError. */
interface ModelListErrorProps {
  provider: Provider;
  message: string;
  onBack: () => void;
}

/** Shown when model fetching fails. */
function ModelListError(props: ModelListErrorProps) {
  useInput((_input, key) => {
    if (key.escape) {
      props.onBack();
    }
  });

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Border color={theme.brand} />
      <Indent>
        <Text bold>Select Model — {props.provider.name}</Text>
      </Indent>
      <Indent>
        <Text color={theme.error}>Failed to load models: {props.message}</Text>
      </Indent>
      <Border color={theme.brand} />
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions items={[{ key: "esc", description: "back" }]} />
      </Box>
    </Box>
  );
}

/** Props for ModelListEmpty. */
interface ModelListEmptyProps {
  provider: Provider;
  onBack: () => void;
}

/** Shown when provider returns no models. */
function ModelListEmpty(props: ModelListEmptyProps) {
  useInput((_input, key) => {
    if (key.escape) {
      props.onBack();
    }
  });

  return (
    <Box flexDirection="column" paddingTop={1}>
      <Border color={theme.brand} />
      <Indent>
        <Text bold>Select Model — {props.provider.name}</Text>
      </Indent>
      <Indent>
        <Text dimColor>No models available from this provider.</Text>
      </Indent>
      <Border color={theme.brand} />
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions items={[{ key: "esc", description: "back" }]} />
      </Box>
    </Box>
  );
}
