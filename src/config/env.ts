import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  
  // AI Keys
  OPENAI_API_KEY: z.string().optional(),
  GROK_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),

  // Application Settings
  AUTO_APPLY_ENABLED: z.string().default('false').transform(val => val === 'true'),
  MAX_DAILY_APPLICATIONS: z.string().default('50').transform(val => parseInt(val, 10)),
  RESUME_PATH: z.string().default('./documents/Kiran S R _ Full Stack Engineer.pdf'),

  // SMTP Mailer (Optional)
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().default('587').transform(val => parseInt(val, 10)),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('skkiran1258@gmail.com'),

  // Storage
  MONGODB_URI: z.string().default('mongodb://localhost:27017/jobpilot'),
  DATABASE_URL: z.string().default('sqlite:///./jobpilot.db')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.format());
  throw new Error('Environment configuration validation failed');
}

export const env = parsed.data;
