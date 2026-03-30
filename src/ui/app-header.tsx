import { Box, Text } from "ink";

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

/** Renders the app logo, tagline, version, and active model/provider. */
export function AppHeader(props: AppHeaderProps) {
  const hasModelAndProvider = props.model && props.provider;

  return (
    <Box flexDirection="column">
      <Text color="cyan" bold>
        {LOGO}
      </Text>
      <Text> </Text>
      <Box paddingLeft={2}>
        <Text color="cyan" bold>
          友
        </Text>
        <Text dimColor> — your local AI companion</Text>
      </Box>
      <Text> </Text>
      <Box paddingLeft={2}>
        {hasModelAndProvider ? (
          <Text dimColor>
            {`v${props.version} · ${props.model} (${props.provider})`}
          </Text>
        ) : (
          <Text
            dimColor
          >{`v${props.version} · No active model or provider`}</Text>
        )}
      </Box>
      <Text> </Text>
    </Box>
  );
}
