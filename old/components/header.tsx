import { Text } from "ink";

declare const TOMO_VERSION: string | undefined;
const version = typeof TOMO_VERSION !== "undefined" ? TOMO_VERSION : "dev";

const LOGO = `
 ╔╦╗╔═╗╔╦╗╔═╗
  ║ ║ ║║║║║ ║
  ╩ ╚═╝╩ ╩╚═╝
`;

interface HeaderProps {
  model: string;
  provider: string;
}

/** Renders the app logo, tagline, version, and active model. */
export function Header({ model, provider }: HeaderProps) {
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
      <Text dimColor>{`  v${version} · ${model} (${provider})`}</Text>
      <Text> </Text>
    </>
  );
}
