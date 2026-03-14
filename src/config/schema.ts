import { z } from 'zod';

export const configSchema = z.object({
  management_key: z.string().min(1),
  api_base: z.string().url(),
  email: z.string().email(),
  created_at: z.string(),
  last_login: z.string(),
});

export type OpenClawTokenConfig = z.infer<typeof configSchema>;
