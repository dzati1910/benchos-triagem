import './config/env';
import cors from 'cors';
import express, { type Express } from 'express';
import { prisma } from './lib/prisma';
import { authRouter } from './modules/auth/auth.routes';
import { categoriasRouter } from './modules/categorias/categorias.routes';
import { clientesRouter } from './modules/clientes/clientes.routes';
import { usersRouter } from './modules/users/users.routes';
import { errorHandler } from './shared/middlewares/errorHandler';

export const app: Express = express();

app.use(cors());
app.use(express.json());

app.get('/api/health', async (_req, res, next) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'OK', message: 'API BenchOS operando normalmente!' });
  } catch (error) {
    next(error);
  }
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/clientes', clientesRouter);
app.use('/api/categorias', categoriasRouter);

app.use(errorHandler);
