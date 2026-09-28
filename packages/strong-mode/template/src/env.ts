import { z } from "zod";

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
