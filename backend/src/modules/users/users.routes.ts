import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middlewares/auth';
import { usersController } from './users.controller';

export const usersRouter = Router();

usersRouter.use(authenticate, requireRole('ADMIN'));

usersRouter.get('/', usersController.list);
usersRouter.post('/', usersController.create);
usersRouter.patch('/:id', usersController.update);
usersRouter.patch('/:id/senha', usersController.resetPassword);
