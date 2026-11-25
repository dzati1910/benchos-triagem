import type { NextFunction, Request, Response } from 'express';
import { createClienteSchema, listClientesQuerySchema } from './clientes.schema';
import { clientesService } from './clientes.service';

/**
 * Controladores HTTP do módulo de clientes.
 */
export const clientesController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { busca } = listClientesQuerySchema.parse(req.query);
      const clientes = await clientesService.listClientes(busca);
      res.json(clientes);
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = createClienteSchema.parse(req.body);
      const cliente = await clientesService.createCliente(payload);
      res.status(201).json(cliente);
    } catch (error) {
      next(error);
    }
  },
};
