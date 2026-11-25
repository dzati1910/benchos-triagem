import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middlewares/auth';
import { categoriasController } from './categorias.controller';

export const categoriasRouter = Router();

categoriasRouter.use(authenticate);

categoriasRouter.get('/', categoriasController.list);
categoriasRouter.post('/', requireRole('ADMIN'), categoriasController.create);
// Rota /itens/:itemId registrada antes de /:id para evitar colisão de parâmetros.
categoriasRouter.patch('/itens/:itemId', requireRole('ADMIN'), categoriasController.updateItem);
categoriasRouter.patch('/:id', requireRole('ADMIN'), categoriasController.update);
categoriasRouter.post('/:id/itens', requireRole('ADMIN'), categoriasController.createItem);
