import { Text, Box } from "ink";

const LOGO = `
 ╔╦╗╔═╗╔╦╗╔═╗
  ║ ║ ║║║║║ ║
  ╩ ╚═╝╩ ╩╚═╝
`;

export function App() {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text color="cyan" bold>
        {LOGO}
      </Text>
      <Text>
        <Text color="cyan" bold>
          友
        </Text>
        <Text dimColor> — your local AI companion</Text>
      </Text>
      <Text dimColor>v0.0.0</Text>
    </Box>
  );
}
