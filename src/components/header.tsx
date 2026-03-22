import { Text } from "ink";

declare const TOMO_VERSION: string;
const version = TOMO_VERSION;

const LOGO = `
 ╔╦╗╔═╗╔╦╗╔═╗
  ║ ║ ║║║║║ ║
  ╩ ╚═╝╩ ╩╚═╝
`;

interface HeaderProps {
  model: string;
}

/** Renders the app logo, tagline, version, and active model. */
export function Header({ model }: HeaderProps) {
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
      <Text dimColor>{`  v${version} · ${model}`}</Text>
      <Text> </Text>
    </>
  );
}
