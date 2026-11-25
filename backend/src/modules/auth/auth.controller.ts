import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../shared/errors/AppError';
import { loginSchema } from './auth.schema';
import { authService } from './auth.service';

/**
 * Controladores HTTP do módulo de autenticação.
 */
export const authController = {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = loginSchema.parse(req.body);
      const result = await authService.login(payload);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuário não autenticado.', 401);
      }

      const result = await authService.getMe(req.user.id);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
};
