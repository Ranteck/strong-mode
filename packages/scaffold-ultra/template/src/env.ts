import { z } from "zod";

// Typed here instead of through @types/node: a project may limit `types` (tsc --init sets
// "types": []), and Node globals must not leak into its other files.
declare const process: {
  readonly env: Readonly<Record<string, string | undefined>>;
};

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  })
  .strict();

type Env = z.infer<typeof EnvSchema>;

const parseEnv = (): Env => {
  const externalInput: unknown = {
    NODE_ENV: process.env["NODE_ENV"],
    LOG_LEVEL: process.env["LOG_LEVEL"],
  };

  const parsed = EnvSchema.safeParse(externalInput);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${["env", ...issue.path].join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(`Invalid environment configuration:\n${details}`);
  }

  return parsed.data;
};

export const env: Env = parseEnv();
