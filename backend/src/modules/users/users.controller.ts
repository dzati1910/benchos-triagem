import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../shared/errors/AppError';
import {
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
  userIdParamSchema,
} from './users.schema';
import { usersService } from './users.service';

/**
 * Controladores HTTP do módulo de gestão de usuários.
 */
export const usersController = {
  async list(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const users = await usersService.listUsers();
      res.json(users);
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = createUserSchema.parse(req.body);
      const user = await usersService.createUser(payload);
      res.status(201).json(user);
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuário não autenticado.', 401);
      }

      const { id } = userIdParamSchema.parse(req.params);
      const payload = updateUserSchema.parse(req.body);
      const user = await usersService.updateUser(id, req.user.id, payload);
      res.json(user);
    } catch (error) {
      next(error);
    }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = userIdParamSchema.parse(req.params);
      const { novaSenha } = resetPasswordSchema.parse(req.body);
      const result = await usersService.resetPassword(id, novaSenha);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
};
