import { Box, Text } from "ink";
import { BlankLine } from "./layout/blank-line";
import { Indent } from "./layout/indent";
import { theme } from "./theme";
import { Hint } from "./typography/hint";

const LOGO = `
 ╔╦╗╔═╗╔╦╗╔═╗
  ║ ║ ║║║║║ ║
  ╩ ╚═╝╩ ╩╚═╝
`;

/** Props for the AppHeader component. */
interface AppHeaderProps {
  version: string;
  model: string | null | undefined;
  provider: string | null | undefined;
}

/** Derives display values from props. */
function useAppHeader(props: AppHeaderProps) {
  const versionLabel = `v${props.version}`;
  const modelInfo =
    props.model && props.provider
      ? `${props.model} (${props.provider})`
      : "No active model or provider";

  return { versionLabel, modelInfo };
}

/** Renders the app logo, tagline, version, and active model/provider. */
export function AppHeader(props: AppHeaderProps) {
  const { versionLabel, modelInfo } = useAppHeader(props);

  return (
    <Box flexDirection="column">
      <Text color={theme.brand} bold>
        {LOGO}
      </Text>
      <BlankLine />
      <Indent>
        <Text color={theme.brand} bold>
          友
        </Text>
        <Text dimColor> · your local AI companion</Text>
      </Indent>
      <Indent>
        <Text color={theme.brand}>{versionLabel}</Text>
        <Hint> · {modelInfo}</Hint>
      </Indent>
    </Box>
  );
}
