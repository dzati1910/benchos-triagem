import type {
  Categoria,
  Cliente,
  ItemChecklist,
  Prisma,
  ResultadoItemChecklist,
  Role,
  StatusTriagem,
  Triagem,
  TriagemResposta,
} from '@prisma/client';
import { prisma } from '../../lib/prisma';

export interface TriagemPublicUser {
  id: number;
  nome: string;
  email: string;
  role: Role;
}

export const triagemUserSelect = {
  id: true,
  nome: true,
  email: true,
  role: true,
} satisfies Prisma.UserSelect;

export const triagemRelationsInclude = {
  cliente: true,
  categoria: true,
  recebidoPor: { select: triagemUserSelect },
  analiseIniciadaPor: { select: triagemUserSelect },
  concluidoPor: { select: triagemUserSelect },
  canceladoPor: { select: triagemUserSelect },
  ultimaAtualizacaoPor: { select: triagemUserSelect },
} satisfies Prisma.TriagemInclude;

export interface TriagemComRelacoes extends Triagem {
  cliente: Cliente;
  categoria: Categoria;
  recebidoPor: TriagemPublicUser;
  analiseIniciadaPor: TriagemPublicUser | null;
  concluidoPor: TriagemPublicUser | null;
  canceladoPor: TriagemPublicUser | null;
  ultimaAtualizacaoPor: TriagemPublicUser | null;
}

export interface TriagemRespostaComUsuario extends TriagemResposta {
  respondidoPor: TriagemPublicUser | null;
}

export interface TriagemComRespostas extends TriagemComRelacoes {
  respostas?: TriagemRespostaComUsuario[];
}

export interface RespostaUpsertPayload {
  itemChecklistId: number;
  resultado: ResultadoItemChecklist;
  observacao: string | null;
}

const PG_MAX_INT32 = 2147483647;

function buildBuscaFilter(busca?: string): Prisma.TriagemWhereInput['OR'] | undefined {
  const termo = busca?.trim();
  if (!termo) {
    return undefined;
  }

  const orFilters: Prisma.TriagemWhereInput[] = [
    { modelo: { contains: termo, mode: 'insensitive' } },
    { fabricante: { contains: termo, mode: 'insensitive' } },
    { numeroSerieMac: { contains: termo, mode: 'insensitive' } },
    { defeitoReclamado: { contains: termo, mode: 'insensitive' } },
    { cliente: { nome: { contains: termo, mode: 'insensitive' } } },
  ];

  if (/^#?\d+$/.test(termo)) {
    const numericText = termo.startsWith('#') ? termo.slice(1) : termo;
    const idNum = Number(numericText);
    if (Number.isInteger(idNum) && idNum > 0 && idNum <= PG_MAX_INT32) {
      orFilters.push({ id: idNum });
    }
  }

  return orFilters;
}

/**
 * Repositório de acesso a triagens, respostas e checklists relacionados via Prisma.
 */
export const triagensRepository = {
  findMany(params: {
    status?: StatusTriagem;
    busca?: string;
    incluirCanceladas: boolean;
  }): Promise<TriagemComRelacoes[]> {
    const where: Prisma.TriagemWhereInput = {};

    if (params.status) {
      where.status = params.status;
    } else if (!params.incluirCanceladas) {
      where.status = { not: 'CANCELADA' };
    }

    const orFilters = buildBuscaFilter(params.busca);
    if (orFilters) {
      where.OR = orFilters;
    }

    return prisma.triagem.findMany({
      where,
      include: triagemRelationsInclude,
      orderBy: { criadoEm: 'desc' },
    });
  },

  findReincidencia(
    numeroSerieMac: string,
    excluirTriagemId?: number,
  ): Promise<TriagemComRelacoes[]> {
    return prisma.triagem.findMany({
      where: {
        numeroSerieMac,
        status: { not: 'CANCELADA' },
        ...(excluirTriagemId !== undefined ? { id: { not: excluirTriagemId } } : {}),
      },
      include: triagemRelationsInclude,
      orderBy: { criadoEm: 'desc' },
    });
  },

  findById(id: number): Promise<TriagemComRelacoes | null> {
    return prisma.triagem.findUnique({
      where: { id },
      include: triagemRelationsInclude,
    });
  },

  findRespostasByTriagemId(triagemId: number): Promise<TriagemRespostaComUsuario[]> {
    return prisma.triagemResposta.findMany({
      where: { triagemId },
      include: {
        respondidoPor: { select: triagemUserSelect },
      },
      orderBy: [{ itemChecklist: { ordem: 'asc' } }, { id: 'asc' }],
    });
  },

  findChecklistForTriagem(
    categoriaId: number,
    respondedItemIds: number[],
  ): Promise<ItemChecklist[]> {
    return prisma.itemChecklist.findMany({
      where:
        respondedItemIds.length > 0
          ? {
              OR: [{ categoriaId, ativo: true }, { id: { in: respondedItemIds } }],
            }
          : { categoriaId, ativo: true },
      orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
    });
  },

  findActiveChecklistByCategoria(categoriaId: number): Promise<ItemChecklist[]> {
    return prisma.itemChecklist.findMany({
      where: { categoriaId, ativo: true },
      orderBy: [{ ordem: 'asc' }, { id: 'asc' }],
    });
  },

  findChecklistItemsInCategoria(categoriaId: number, itemIds: number[]): Promise<ItemChecklist[]> {
    if (itemIds.length === 0) {
      return Promise.resolve([]);
    }

    return prisma.itemChecklist.findMany({
      where: {
        id: { in: itemIds },
        categoriaId,
      },
    });
  },

  findClienteById(id: number): Promise<Cliente | null> {
    return prisma.cliente.findUnique({ where: { id } });
  },

  findCategoriaById(id: number): Promise<Categoria | null> {
    return prisma.categoria.findUnique({ where: { id } });
  },

  countRespostasByTriagemId(triagemId: number): Promise<number> {
    return prisma.triagemResposta.count({ where: { triagemId } });
  },

  create(data: Prisma.TriagemUncheckedCreateInput): Promise<TriagemComRelacoes> {
    return prisma.triagem.create({
      data,
      include: triagemRelationsInclude,
    });
  },

  update(id: number, data: Prisma.TriagemUncheckedUpdateInput): Promise<TriagemComRelacoes> {
    return prisma.triagem.update({
      where: { id },
      data,
      include: triagemRelationsInclude,
    });
  },

  updateClearingRespostas(
    id: number,
    data: Prisma.TriagemUncheckedUpdateInput,
  ): Promise<TriagemComRelacoes> {
    return prisma.$transaction(async (tx) => {
      await tx.triagemResposta.deleteMany({
        where: { triagemId: id },
      });

      return tx.triagem.update({
        where: { id },
        data,
        include: triagemRelationsInclude,
      });
    });
  },

  persistRespostasAndUpdateTriagem(params: {
    triagemId: number;
    actorId: number;
    respostas: RespostaUpsertPayload[];
    triagemData: Prisma.TriagemUncheckedUpdateInput;
  }): Promise<TriagemComRespostas> {
    return prisma.$transaction(async (tx) => {
      for (const resposta of params.respostas) {
        await tx.triagemResposta.upsert({
          where: {
            triagemId_itemChecklistId: {
              triagemId: params.triagemId,
              itemChecklistId: resposta.itemChecklistId,
            },
          },
          create: {
            triagemId: params.triagemId,
            itemChecklistId: resposta.itemChecklistId,
            resultado: resposta.resultado,
            observacao: resposta.observacao,
            respondidoPorId: params.actorId,
          },
          update: {
            resultado: resposta.resultado,
            observacao: resposta.observacao,
            respondidoPorId: params.actorId,
          },
        });
      }

      return tx.triagem.update({
        where: { id: params.triagemId },
        data: params.triagemData,
        include: {
          ...triagemRelationsInclude,
          respostas: {
            include: { respondidoPor: { select: triagemUserSelect } },
            orderBy: [{ itemChecklist: { ordem: 'asc' } }, { id: 'asc' }],
          },
        },
      });
    });
  },
};
