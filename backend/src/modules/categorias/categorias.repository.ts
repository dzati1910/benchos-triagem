import type { Categoria, ItemChecklist } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export interface CategoriaComItens extends Categoria {
  itens: ItemChecklist[];
}

/**
 * Repositório de acesso a categorias e itens de checklist via Prisma.
 */
export const categoriasRepository = {
  findManyWithItens(incluirInativos: boolean): Promise<CategoriaComItens[]> {
    return prisma.categoria.findMany({
      where: incluirInativos ? undefined : { ativo: true },
      include: {
        itens: {
          where: incluirInativos ? undefined : { ativo: true },
          orderBy: { ordem: 'asc' },
        },
      },
      orderBy: { id: 'asc' },
    });
  },

  findById(id: number): Promise<Categoria | null> {
    return prisma.categoria.findUnique({
      where: { id },
    });
  },

  findByNome(nome: string): Promise<Categoria | null> {
    return prisma.categoria.findUnique({
      where: { nome },
    });
  },

  createCategoria(data: {
    nome: string;
    icone: string;
    instrucaoGeral: string | null;
  }): Promise<Categoria> {
    return prisma.categoria.create({ data });
  },

  updateCategoria(
    id: number,
    data: {
      nome?: string;
      icone?: string;
      instrucaoGeral?: string | null;
      ativo?: boolean;
    },
  ): Promise<Categoria> {
    return prisma.categoria.update({
      where: { id },
      data,
    });
  },

  findItemById(id: number): Promise<ItemChecklist | null> {
    return prisma.itemChecklist.findUnique({
      where: { id },
    });
  },

  async findMaxOrdemByCategoria(categoriaId: number): Promise<number> {
    const result = await prisma.itemChecklist.aggregate({
      where: { categoriaId },
      _max: { ordem: true },
    });
    return result._max.ordem ?? 0;
  },

  createItem(data: {
    categoriaId: number;
    descricao: string;
    comoTestar: string;
    ordem: number;
  }): Promise<ItemChecklist> {
    return prisma.itemChecklist.create({ data });
  },

  updateItem(
    id: number,
    data: {
      descricao?: string;
      comoTestar?: string;
      ordem?: number;
      ativo?: boolean;
    },
  ): Promise<ItemChecklist> {
    return prisma.itemChecklist.update({
      where: { id },
      data,
    });
  },
};
