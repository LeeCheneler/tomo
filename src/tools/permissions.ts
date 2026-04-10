import { resolve } from "node:path";
import type { Permissions } from "../config/schema";

/** Result of a permission check. */
export type PermissionResult = "allowed" | "needs-confirmation";

/** Path operation type for permission lookups. Covers files and directories. */
export type PathOperation = "read" | "write" | "remove";

/** Maps a path operation to its cwd and global permission keys. */
const PERMISSION_KEYS: Record<
  PathOperation,
  { cwd: keyof Permissions; global: keyof Permissions }
> = {
  read: { cwd: "cwdReadFile", global: "globalReadFile" },
  write: { cwd: "cwdWriteFile", global: "globalWriteFile" },
  remove: { cwd: "cwdRemoveFile", global: "globalRemoveFile" },
};

/** Returns true if the resolved path is within the current working directory. */
export function isPathWithinCwd(filePath: string): boolean {
  const resolved = resolve(filePath);
  const cwd = process.cwd();
  return resolved === cwd || resolved.startsWith(`${cwd}/`);
}

/**
 * Checks access permission for a path based on the operation type and path location.
 * Returns "allowed" if the config permits access, "needs-confirmation" otherwise.
 */
export function checkPathPermission(
  filePath: string,
  operation: PathOperation,
  permissions: Permissions,
): PermissionResult {
  const inCwd = isPathWithinCwd(filePath);
  const key = inCwd
    ? PERMISSION_KEYS[operation].cwd
    : PERMISSION_KEYS[operation].global;
  return permissions[key] ? "allowed" : "needs-confirmation";
}
