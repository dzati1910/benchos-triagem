import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../shared/errors/AppError';
import {
  categoriaIdParamSchema,
  createCategoriaSchema,
  createItemChecklistSchema,
  itemIdParamSchema,
  listCategoriasQuerySchema,
  updateCategoriaSchema,
  updateItemChecklistSchema,
} from './categorias.schema';
import { categoriasService } from './categorias.service';

/**
 * Controladores HTTP do módulo de categorias e itens de checklist.
 */
export const categoriasController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw new AppError('Usuário não autenticado.', 401);
      }

      const { incluirInativos } = listCategoriasQuerySchema.parse(req.query);
      const categorias = await categoriasService.listCategorias(req.user.role, incluirInativos);
      res.json(categorias);
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = createCategoriaSchema.parse(req.body);
      const categoria = await categoriasService.createCategoria(payload);
      res.status(201).json(categoria);
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = categoriaIdParamSchema.parse(req.params);
      const payload = updateCategoriaSchema.parse(req.body);
      const categoria = await categoriasService.updateCategoria(id, payload);
      res.json(categoria);
    } catch (error) {
      next(error);
    }
  },

  async createItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = categoriaIdParamSchema.parse(req.params);
      const payload = createItemChecklistSchema.parse(req.body);
      const item = await categoriasService.createItem(id, payload);
      res.status(201).json(item);
    } catch (error) {
      next(error);
    }
  },

  async updateItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { itemId } = itemIdParamSchema.parse(req.params);
      const payload = updateItemChecklistSchema.parse(req.body);
      const item = await categoriasService.updateItem(itemId, payload);
      res.json(item);
    } catch (error) {
      next(error);
    }
  },
};
