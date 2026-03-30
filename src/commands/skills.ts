import chalk from "chalk";
import { getAllSkills } from "../skills";
import { ok } from "../tools/types";
import { register } from "./registry";
import type { Command } from "./types";

function truncate(str: string, max: number): string {
  return str.length > max ? `${str.slice(0, max - 1)}…` : str;
}

const skills: Command = {
  name: "skills",
  description: "List available skills",
  execute: () => {
    const allSkills = getAllSkills();
    if (allSkills.length === 0) {
      return ok("No skills found.");
    }
    const maxName = Math.max(...allSkills.map((s) => s.name.length));
    const lines = allSkills.map(
      (s) =>
        `  ${chalk.bold.cyan(s.name.padEnd(maxName))}  ${chalk.dim(truncate(s.description, 50))}`,
    );
    return ok(`Available skills:\n \n${lines.join("\n")}`);
  },
};

register(skills);
