import chalk from "chalk";
import { render } from "ink";
import { App } from "./app";
import { getLastSavedSessionId } from "./session";

const { waitUntilExit } = render(<App />, { exitOnCtrlC: false });
await waitUntilExit();

const sessionId = getLastSavedSessionId();
if (sessionId) {
  console.log(
    `\n  ${chalk.dim("Resume with")} ${chalk.cyan(`/session ${sessionId}`)}`,
  );
}
