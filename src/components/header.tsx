import { createRequire } from "node:module";
import { Text } from "ink";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json");

const LOGO = `
 ╔╦╗╔═╗╔╦╗╔═╗
  ║ ║ ║║║║║ ║
  ╩ ╚═╝╩ ╩╚═╝
`;

/** Renders the app logo, tagline, and version. */
export function Header() {
  return (
    <>
      <Text color="cyan" bold>
        {LOGO}
      </Text>
      <Text> </Text>
      <Text>
        <Text color="cyan" bold>
          {"  友"}
        </Text>
        <Text dimColor> — your local AI companion</Text>
      </Text>
      <Text> </Text>
      <Text dimColor>{`  v${version}`}</Text>
      <Text> </Text>
    </>
  );
}
