import { z } from "zod";

/** Schema for the application config. */
export const configSchema = z.object({
  activeModel: z.string().nullish(),
  activeProvider: z.string().nullish(),
});

/** Application config type inferred from the schema. */
export type Config = z.infer<typeof configSchema>;
