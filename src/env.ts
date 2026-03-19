export const env = {
  get(name: string): string {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
  },

  getOptional(name: string): string | undefined {
    return process.env[name];
  },
};
