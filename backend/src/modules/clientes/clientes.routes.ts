import { Router } from 'express';
import { authenticate } from '../../shared/middlewares/auth';
import { clientesController } from './clientes.controller';

export const clientesRouter = Router();

clientesRouter.use(authenticate);

clientesRouter.get('/', clientesController.list);
clientesRouter.post('/', clientesController.create);
