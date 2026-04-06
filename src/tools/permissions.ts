import { resolve } from "node:path";
import type { Permissions } from "../config/schema";

/** Result of a permission check. */
export type PermissionResult = "allowed" | "needs-confirmation";

/** File operation type for permission lookups. */
export type FileOperation = "read" | "write";

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

  if (inCwd) {
    const key = operation === "read" ? "cwdReadFile" : "cwdWriteFile";
    return permissions[key] ? "allowed" : "needs-confirmation";
  }

  const key = operation === "read" ? "globalReadFile" : "globalWriteFile";
  return permissions[key] ? "allowed" : "needs-confirmation";
}
