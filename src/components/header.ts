import { createRequire } from "node:module";
import chalk from "chalk";

const require = createRequire(import.meta.url);
const { version } = require("../../package.json");

const LOGO = `
 ╔╦╗╔═╗╔╦╗╔═╗
  ║ ║ ║║║║║ ║
  ╩ ╚═╝╩ ╩╚═╝
`;

/** Prints the app header to stdout. Call once at startup before Ink renders. */
export function printHeader(model: string): void {
  console.log(chalk.cyan.bold(LOGO));
  console.log(
    `  ${chalk.cyan.bold("友")}${chalk.dim(" — your local AI companion")}`,
  );
  console.log();
  console.log(`  ${chalk.dim(`v${version} · ${model}`)}`);
  console.log();
}
