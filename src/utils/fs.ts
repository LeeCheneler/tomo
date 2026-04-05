import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";

/** Checks if a file exists at the given path. */
export function fileExists(path: string): boolean {
  return existsSync(path);
}

/** Reads a file as UTF-8 text. Throws if the file does not exist. */
export function readFile(path: string): string {
  return readFileSync(path, "utf-8");
}

/** Writes UTF-8 text to a file, creating it if it doesn't exist. */
export function writeFile(path: string, content: string): void {
  writeFileSync(path, content, "utf-8");
}

/** Appends UTF-8 text to a file, creating it if it doesn't exist. */
export function appendFile(path: string, content: string): void {
  appendFileSync(path, content, "utf-8");
}

/** Lists filenames in a directory. Returns an empty array if the directory does not exist. */
export function listDir(path: string): string[] {
  if (!existsSync(path)) return [];
  return readdirSync(path, "utf-8");
}

/** Returns true if the path exists and is a directory. */
export function isDirectory(path: string): boolean {
  if (!existsSync(path)) return false;
  return statSync(path).isDirectory();
}

/** Creates a directory and any missing parents. */
export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}
