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

/** Derives the version info line from props. */
function useAppHeader(props: AppHeaderProps) {
  const versionInfo =
    props.model && props.provider
      ? `v${props.version} · ${props.model} (${props.provider})`
      : `v${props.version} · No active model or provider`;

  return { versionInfo };
}

/** Renders the app logo, tagline, version, and active model/provider. */
export function AppHeader(props: AppHeaderProps) {
  const { versionInfo } = useAppHeader(props);

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
        <Text dimColor> — your local AI companion</Text>
      </Indent>
      <BlankLine />
      <Indent>
        <Hint>{versionInfo}</Hint>
      </Indent>
      <BlankLine />
    </Box>
  );
}
