import './config/env';
import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express, { type Express } from 'express';
import { prisma } from './lib/prisma';
import { authRouter } from './modules/auth/auth.routes';
import { categoriasRouter } from './modules/categorias/categorias.routes';
import { clientesRouter } from './modules/clientes/clientes.routes';
import { triagensRouter } from './modules/triagens/triagens.routes';
import { usersRouter } from './modules/users/users.routes';
import { errorHandler } from './shared/middlewares/errorHandler';

export interface CreateAppOptions {
  frontendDistDir?: string;
}

/**
 * Resolve automaticamente a pasta compilada do frontend em ambiente de produção.
 */
export function resolveDefaultFrontendDistDir(): string | undefined {
  const isProdRuntime =
    process.env.NODE_ENV === 'production' || path.basename(__dirname) === 'dist';
  if (process.env.VITEST || !isProdRuntime) {
    return undefined;
  }

  const candidateDir = path.resolve(__dirname, '../../frontend/dist');
  const indexHtml = path.join(candidateDir, 'index.html');
  return fs.existsSync(indexHtml) ? candidateDir : undefined;
}

/**
 * Cria a instância configurada da aplicação Express (API + SPA estática opcional em produção).
 */
export function createApp(options?: CreateAppOptions): Express {
  const instance: Express = express();

  instance.use(cors());
  instance.use(express.json());

  instance.get('/api/health', async (_req, res, next) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.json({ status: 'OK', message: 'API BenchOS operando normalmente!' });
    } catch (error) {
      next(error);
    }
  });

  instance.use('/api/auth', authRouter);
  instance.use('/api/users', usersRouter);
  instance.use('/api/clientes', clientesRouter);
  instance.use('/api/categorias', categoriasRouter);
  instance.use('/api/triagens', triagensRouter);

  instance.use('/api', (_req, res) => {
    res.status(404).json({ error: 'Rota da API não encontrada.' });
  });

  const rawDistDir = options?.frontendDistDir ?? resolveDefaultFrontendDistDir();
  const distDir = rawDistDir ? path.resolve(rawDistDir) : undefined;
  if (distDir) {
    const indexHtmlPath = path.join(distDir, 'index.html');
    if (fs.existsSync(indexHtmlPath)) {
      instance.use(
        express.static(distDir, {
          setHeaders: (res, filePath) => {
            if (path.basename(filePath) === 'index.html') {
              res.setHeader('Cache-Control', 'no-cache');
            }
          },
        }),
      );

      instance.get('*', (req, res, next) => {
        if (req.path === '/api' || req.path.startsWith('/api/')) {
          return next();
        }
        if (req.path.startsWith('/assets/')) {
          return res.status(404).end();
        }
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(indexHtmlPath);
      });
    }
  }

  instance.use(errorHandler);

  return instance;
}

export const app: Express = createApp();
