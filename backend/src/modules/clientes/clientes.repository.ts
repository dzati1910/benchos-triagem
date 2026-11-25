import type { Cliente } from '@prisma/client';
import { prisma } from '../../lib/prisma';

/**
 * Repositório de acesso aos dados de clientes via Prisma.
 */
export const clientesRepository = {
  findMany(busca?: string): Promise<Cliente[]> {
    const termo = busca?.trim();

    return prisma.cliente.findMany({
      where: termo
        ? {
            OR: [
              { nome: { contains: termo, mode: 'insensitive' } },
              { telefone: { contains: termo, mode: 'insensitive' } },
              { documento: { contains: termo, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { nome: 'asc' },
    });
  },

  create(data: {
    nome: string;
    telefone: string | null;
    documento: string | null;
  }): Promise<Cliente> {
    return prisma.cliente.create({ data });
  },
};
