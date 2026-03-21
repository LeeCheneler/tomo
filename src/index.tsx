import chalk from "chalk";
import { render } from "ink";
import { App } from "./app";
import { printHeader } from "./components/header";
import { loadConfig } from "./config";
import { getLastSavedSessionId } from "./session";

const config = loadConfig();
printHeader(config.activeModel);

const { waitUntilExit } = render(<App />, { exitOnCtrlC: false });
await waitUntilExit();

const sessionId = getLastSavedSessionId();
if (sessionId) {
  console.log(
    `\n  ${chalk.dim("Resume with")} ${chalk.cyan(`/session ${sessionId}`)}`,
  );
}
