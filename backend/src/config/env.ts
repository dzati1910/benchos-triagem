import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

if (!process.env.VITEST) {
  const backendEnvPath = path.resolve(__dirname, '../../.env');
  dotenv.config(fs.existsSync(backendEnvPath) ? { path: backendEnvPath } : undefined);
}

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET deve ter no mínimo 16 caracteres'),
  JWT_EXPIRES_IN: z.string().min(1).default('7d'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Variáveis de ambiente inválidas:', parsed.error.issues);
  throw new Error('Configuração de ambiente inválida.');
}

export const env = parsed.data;
