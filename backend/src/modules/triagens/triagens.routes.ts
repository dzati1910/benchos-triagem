import { Router } from 'express';
import { authenticate, requireRole } from '../../shared/middlewares/auth';
import { triagensController } from './triagens.controller';

export const triagensRouter = Router();

triagensRouter.use(authenticate);

triagensRouter.get('/', triagensController.list);
// Rota /reincidencia registrada antes de /:id para evitar colisão de parâmetro numérico.
triagensRouter.get('/reincidencia', triagensController.reincidencia);
triagensRouter.get('/:id', triagensController.getById);
triagensRouter.post('/', triagensController.create);
triagensRouter.patch('/:id', triagensController.update);
triagensRouter.patch('/:id/cancelar', triagensController.cancelar);
triagensRouter.patch('/:id/iniciar', triagensController.iniciar);
triagensRouter.patch('/:id/progresso', triagensController.progresso);
triagensRouter.patch('/:id/concluir', triagensController.concluir);
triagensRouter.patch('/:id/reabrir', requireRole('ADMIN'), triagensController.reabrir);
