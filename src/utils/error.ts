/** Extracts a message string from an unknown caught value. */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return "unknown error";
}
