import type { Categoria, ItemChecklist, Role } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import { type CategoriaComItens, categoriasRepository } from './categorias.repository';
import type {
  CreateCategoriaInput,
  CreateItemChecklistInput,
  UpdateCategoriaInput,
  UpdateItemChecklistInput,
} from './categorias.schema';

/**
 * Regras de negócio para categorias de equipamento e checklists guiados.
 */
export const categoriasService = {
  async listCategorias(
    actorRole: Role,
    incluirInativos: boolean,
  ): Promise<CategoriaComItens[]> {
    if (incluirInativos && actorRole !== 'ADMIN') {
      throw new AppError('Acesso restrito a administradores.', 403);
    }

    return categoriasRepository.findManyWithItens(incluirInativos);
  },

  async createCategoria(input: CreateCategoriaInput): Promise<Categoria> {
    const nome = input.nome.trim();
    const existing = await categoriasRepository.findByNome(nome);
    if (existing) {
      throw new AppError('Já existe uma categoria cadastrada com este nome.', 409);
    }

    return categoriasRepository.createCategoria({
      nome,
      icone: input.icone.trim(),
      instrucaoGeral: input.instrucaoGeral?.trim() || null,
    });
  },

  async updateCategoria(id: number, input: UpdateCategoriaInput): Promise<Categoria> {
    const existing = await categoriasRepository.findById(id);
    if (!existing) {
      throw new AppError('Categoria não encontrada.', 404);
    }

    const nome = input.nome !== undefined ? input.nome.trim() : undefined;
    if (nome !== undefined && nome !== existing.nome) {
      const conflict = await categoriasRepository.findByNome(nome);
      if (conflict && conflict.id !== id) {
        throw new AppError('Já existe uma categoria cadastrada com este nome.', 409);
      }
    }

    return categoriasRepository.updateCategoria(id, {
      ...(nome !== undefined ? { nome } : {}),
      ...(input.icone !== undefined ? { icone: input.icone.trim() } : {}),
      ...(input.instrucaoGeral !== undefined
        ? { instrucaoGeral: input.instrucaoGeral?.trim() || null }
        : {}),
      ...(input.ativo !== undefined ? { ativo: input.ativo } : {}),
    });
  },

  async createItem(categoriaId: number, input: CreateItemChecklistInput): Promise<ItemChecklist> {
    const categoria = await categoriasRepository.findById(categoriaId);
    if (!categoria) {
      throw new AppError('Categoria não encontrada.', 404);
    }

    const ordem =
      input.ordem !== undefined
        ? input.ordem
        : (await categoriasRepository.findMaxOrdemByCategoria(categoriaId)) + 1;

    return categoriasRepository.createItem({
      categoriaId,
      descricao: input.descricao.trim(),
      comoTestar: input.comoTestar.trim(),
      ordem,
    });
  },

  async updateItem(itemId: number, input: UpdateItemChecklistInput): Promise<ItemChecklist> {
    const existing = await categoriasRepository.findItemById(itemId);
    if (!existing) {
      throw new AppError('Item de checklist não encontrado.', 404);
    }

    return categoriasRepository.updateItem(itemId, {
      ...(input.descricao !== undefined ? { descricao: input.descricao.trim() } : {}),
      ...(input.comoTestar !== undefined ? { comoTestar: input.comoTestar.trim() } : {}),
      ...(input.ordem !== undefined ? { ordem: input.ordem } : {}),
      ...(input.ativo !== undefined ? { ativo: input.ativo } : {}),
    });
  },
};
