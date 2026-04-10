import { resolve } from "node:path";
import type { Permissions } from "../config/schema";

/** Result of a permission check. */
export type PermissionResult = "allowed" | "needs-confirmation";

/** File operation type for permission lookups. */
export type FileOperation = "read" | "write" | "remove";

/** Maps a file operation to its cwd and global permission keys. */
const PERMISSION_KEYS: Record<
  FileOperation,
  { cwd: keyof Permissions; global: keyof Permissions }
> = {
  read: { cwd: "cwdReadFile", global: "globalReadFile" },
  write: { cwd: "cwdWriteFile", global: "globalWriteFile" },
  remove: { cwd: "cwdRemoveFile", global: "globalRemoveFile" },
};

/** Returns true if the resolved file path is within the current working directory. */
export function isPathWithinCwd(filePath: string): boolean {
  const resolved = resolve(filePath);
  const cwd = process.cwd();
  return resolved === cwd || resolved.startsWith(`${cwd}/`);
}

/**
 * Checks file access permission based on the operation type and file location.
 * Returns "allowed" if the config permits access, "needs-confirmation" otherwise.
 */
export function checkFilePermission(
  filePath: string,
  operation: FileOperation,
  permissions: Permissions,
): PermissionResult {
  const inCwd = isPathWithinCwd(filePath);
  const key = inCwd
    ? PERMISSION_KEYS[operation].cwd
    : PERMISSION_KEYS[operation].global;
  return permissions[key] ? "allowed" : "needs-confirmation";
}
