/** Environment variable access with required/optional variants. */
export const env = {
  /** Returns the value of a required environment variable. Throws if missing or empty. */
  get(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
  },

  /** Returns the value of an environment variable, or undefined if not set. */
  getOptional(name: string): string | undefined {
    return process.env[name];
  },
};
