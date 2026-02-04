import { z } from "zod";

export const ValidationSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
});

export type Validation = z.infer<typeof ValidationSchema>;
