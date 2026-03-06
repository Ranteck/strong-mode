import { z } from "zod";
import { env } from "./env.js";

const IncomingPayloadSchema = z
  .object({
    id: z.string().uuid(),
    active: z.boolean(),
  })
  .strict();

export type IncomingPayload = z.infer<typeof IncomingPayloadSchema>;

export const parseIncomingPayload = (externalInput: unknown): IncomingPayload =>
  IncomingPayloadSchema.parse(externalInput);

export { env };
