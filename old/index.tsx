import chalk from "chalk";
import { render } from "ink";
import { createElement } from "react";
import { App } from "./app";
import { getLastSavedSessionId } from "./session";

let restarting = false;

function start() {
  restarting = false;
  const instance = render(createElement(App, { onRestart: restart }), {
    exitOnCtrlC: false,
  });
  return instance;
}

function restart() {
  restarting = true;
  instance.unmount();
  process.stdout.write("\x1B[2J\x1B[H\x1B[3J");
  instance = start();
}

let instance = start();

// Re-await on restart — loop until a normal (non-restart) exit.
while (true) {
  await instance.waitUntilExit();
  if (!restarting) break;
}

const sessionId = getLastSavedSessionId();
if (sessionId) {
  console.log(
    `\n  ${chalk.dim("Resume with")} ${chalk.cyan(`/session ${sessionId}`)}`,
  );
}
