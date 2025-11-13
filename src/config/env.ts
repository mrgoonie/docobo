import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  DISCORD_BOT_TOKEN: z.string().min(1, 'Discord bot token required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'Discord client ID required'),
  DISCORD_GUILD_ID: z.string().optional(),
  DATABASE_URL: z.string().url('Valid PostgreSQL URL required'),
  POLAR_WEBHOOK_SECRET: z.string().min(1, 'Polar webhook secret required'),
  POLAR_ACCESS_TOKEN: z.string().min(1, 'Polar access token required'),
  SEPAY_CLIENT_ID: z.string().min(1, 'SePay client ID required'),
  SEPAY_CLIENT_SECRET: z.string().min(1, 'SePay client secret required'),
  SEPAY_WEBHOOK_SECRET: z.string().min(1, 'SePay webhook secret required'),
  WEBHOOK_PORT: z.string().default('3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('❌ Invalid environment variables:');
    console.error(parsed.error.format());
    process.exit(1);
  }

  return parsed.data;
}

export const env = validateEnv();
