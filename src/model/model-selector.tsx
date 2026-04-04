import { Box, Text, useInput } from "ink";
import { useState } from "react";
import type { TakeoverDone } from "../commands/registry";
import { loadConfig } from "../config/file";
import type { Provider } from "../config/schema";
import { Border } from "../ui/border";
import type { InstructionItem } from "../ui/key-instructions";
import { KeyInstructions } from "../ui/key-instructions";
import { Indent } from "../ui/layout/indent";
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
  const [providers] = useState<Provider[]>(() => loadConfig().providers);
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

  return {
    providers,
    providerItems: buildProviderItems(providers),
    step,
    handleSelectProvider,
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
    handleBackToProviders,
    handleExit,
  } = useModelSelector(props);

  if (step.kind === "models") {
    return (
      <ModelListPlaceholder
        provider={step.provider}
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

/** Props for ModelListPlaceholder. */
interface ModelListPlaceholderProps {
  provider: Provider;
  onBack: () => void;
}

/** Temporary placeholder for the model list screen. */
function ModelListPlaceholder(props: ModelListPlaceholderProps) {
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
        <Text dimColor>Coming soon</Text>
      </Indent>
      <Border color={theme.brand} />
      <Box justifyContent="flex-end" height={1}>
        <KeyInstructions items={[{ key: "esc", description: "back" }]} />
      </Box>
    </Box>
  );
}
