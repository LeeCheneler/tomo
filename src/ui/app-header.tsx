import { Box, Text } from "ink";

const LOGO = `
 ╔╦╗╔═╗╔╦╗╔═╗
  ║ ║ ║║║║║ ║
  ╩ ╚═╝╩ ╩╚═╝
`;

interface AppHeaderProps {
  version: string;
  model: string;
  provider: string;
}

/** Renders the app logo, tagline, version, and active model/provider. */
export function AppHeader(props: AppHeaderProps) {
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
        <Text
          dimColor
        >{`v${props.version} · ${props.model} (${props.provider})`}</Text>
      </Box>
      <Text> </Text>
    </Box>
  );
}
