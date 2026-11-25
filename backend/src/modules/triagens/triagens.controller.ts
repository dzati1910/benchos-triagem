import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../shared/errors/AppError';
import {
  concluirTriagemSchema,
  createTriagemSchema,
  listTriagensQuerySchema,
  reincidenciaQuerySchema,
  salvarProgressoSchema,
  triagemIdParamSchema,
  updateTriagemSchema,
} from './triagens.schema';
import { triagensService } from './triagens.service';

function requireActorId(req: Request): number {
  if (!req.user) {
    throw new AppError('Usuário não autenticado.', 401);
  }
  return req.user.id;
}

/**
 * Controladores HTTP do módulo de triagens técnicas.
 */
export const triagensController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = listTriagensQuerySchema.parse(req.query);
      const triagens = await triagensService.listTriagens(query);
      res.json(triagens);
    } catch (error) {
      next(error);
    }
  },

  async reincidencia(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = reincidenciaQuerySchema.parse(req.query);
      const historico = await triagensService.buscarReincidencia(query);
      res.json(historico);
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = triagemIdParamSchema.parse(req.params);
      const detalhe = await triagensService.getTriagemById(id);
      res.json(detalhe);
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = requireActorId(req);
      const payload = createTriagemSchema.parse(req.body);
      const triagem = await triagensService.createTriagem(payload, actorId);
      res.status(201).json(triagem);
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = requireActorId(req);
      const { id } = triagemIdParamSchema.parse(req.params);
      const payload = updateTriagemSchema.parse(req.body);
      const triagem = await triagensService.updateTriagem(id, payload, actorId);
      res.json(triagem);
    } catch (error) {
      next(error);
    }
  },

  async cancelar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = requireActorId(req);
      const { id } = triagemIdParamSchema.parse(req.params);
      const triagem = await triagensService.cancelarTriagem(id, actorId);
      res.json(triagem);
    } catch (error) {
      next(error);
    }
  },

  async iniciar(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = requireActorId(req);
      const { id } = triagemIdParamSchema.parse(req.params);
      const triagem = await triagensService.iniciarAnalise(id, actorId);
      res.json(triagem);
    } catch (error) {
      next(error);
    }
  },

  async progresso(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = requireActorId(req);
      const { id } = triagemIdParamSchema.parse(req.params);
      const payload = salvarProgressoSchema.parse(req.body);
      const triagem = await triagensService.salvarProgresso(id, payload, actorId);
      res.json(triagem);
    } catch (error) {
      next(error);
    }
  },

  async concluir(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = requireActorId(req);
      const { id } = triagemIdParamSchema.parse(req.params);
      const payload = concluirTriagemSchema.parse(req.body);
      const triagem = await triagensService.concluirTriagem(id, payload, actorId);
      res.json(triagem);
    } catch (error) {
      next(error);
    }
  },

  async reabrir(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const actorId = requireActorId(req);
      const { id } = triagemIdParamSchema.parse(req.params);
      const triagem = await triagensService.reabrirTriagem(id, actorId);
      res.json(triagem);
    } catch (error) {
      next(error);
    }
  },
};
