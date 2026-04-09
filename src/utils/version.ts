declare const TOMO_VERSION: string | undefined;

/** Application version, injected at build time or "dev" in development. */
export const version =
  typeof TOMO_VERSION !== "undefined" ? TOMO_VERSION : "dev";
