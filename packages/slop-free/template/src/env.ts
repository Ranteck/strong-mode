import { z } from "zod";

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  })
  .strict();

export type Env = z.infer<typeof EnvSchema>;

const parseEnv = (): Env => {
  const externalInput: unknown = {
    NODE_ENV: process.env.NODE_ENV,
    LOG_LEVEL: process.env.LOG_LEVEL,
  };

  const parsed = EnvSchema.safeParse(externalInput);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("\n");

    process.stderr.write(`Invalid environment configuration:\n${details}\n`);
    process.exit(1);
  }

  return parsed.data;
};

export const env: Env = parseEnv();
