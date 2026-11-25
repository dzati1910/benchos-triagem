import cors from 'cors';
import express, { type Express } from 'express';
import { prisma } from './lib/prisma';
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

app.use(errorHandler);
