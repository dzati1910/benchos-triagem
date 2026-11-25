import type { ItemChecklist, Prisma, ResultadoItemChecklist } from '@prisma/client';
import { AppError } from '../../shared/errors/AppError';
import { gerarResumoClienteSugestao, normalizarSerial } from './triagem.utils';
import {
  type RespostaUpsertPayload,
  type TriagemComRelacoes,
  type TriagemComRespostas,
  type TriagemRespostaComUsuario,
  triagensRepository,
} from './triagens.repository';
import type {
  ConcluirTriagemInput,
  CreateTriagemInput,
  ListTriagensQuery,
  ReincidenciaQuery,
  RespostaChecklistInput,
  SalvarProgressoInput,
  UpdateTriagemInput,
} from './triagens.schema';

export interface TriagemDetailResponse {
  triagem: TriagemComRelacoes;
  itensChecklist: ItemChecklist[];
  respostas: TriagemRespostaComUsuario[];
}

function isStatusAberto(status: TriagemComRelacoes['status']): boolean {
  return status === 'PENDENTE' || status === 'EM_ANALISE';
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function getTriagemOrThrow(id: number): Promise<TriagemComRelacoes> {
  const triagem = await triagensRepository.findById(id);
  if (!triagem) {
    throw new AppError('Triagem não encontrada.', 404);
  }
  return triagem;
}

function ensureTriagemAberta(triagem: TriagemComRelacoes, mensagem: string): void {
  if (!isStatusAberto(triagem.status)) {
    throw new AppError(mensagem, 409);
  }
}

async function ensureClienteExists(clienteId: number): Promise<void> {
  const cliente = await triagensRepository.findClienteById(clienteId);
  if (!cliente) {
    throw new AppError('Cliente não encontrado.', 404);
  }
}

async function ensureCategoriaExists(categoriaId: number): Promise<void> {
  const categoria = await triagensRepository.findCategoriaById(categoriaId);
  if (!categoria) {
    throw new AppError('Categoria não encontrada.', 404);
  }
}

async function validateRespostasBelongToCategoria(
  respostas: RespostaChecklistInput[],
  categoriaId: number,
): Promise<void> {
  if (respostas.length === 0) {
    return;
  }

  const uniqueIds = Array.from(new Set(respostas.map((item) => item.itemChecklistId)));
  if (uniqueIds.length !== respostas.length) {
    throw new AppError('Existem itens de checklist duplicados na requisição.', 400);
  }

  const validItems = await triagensRepository.findChecklistItemsInCategoria(categoriaId, uniqueIds);
  const validItemIds = new Set(validItems.map((item) => item.id));
  if (uniqueIds.some((itemId) => !validItemIds.has(itemId))) {
    throw new AppError('Um ou mais itens do checklist não pertencem à categoria desta triagem.', 400);
  }
}

function buildInicioCampos(existing: TriagemComRelacoes, actorId: number, now: Date) {
  return {
    analiseIniciadaPorId: existing.analiseIniciadaPorId ?? actorId,
    analiseIniciadaEm: existing.analiseIniciadaEm ?? now,
  };
}

/**
 * Regras de negócio do ciclo de vida das triagens técnicas na bancada.
 */
export const triagensService = {
  listTriagens(query: ListTriagensQuery): Promise<TriagemComRelacoes[]> {
    return triagensRepository.findMany({
      status: query.status,
      busca: query.busca,
      incluirCanceladas: query.incluirCanceladas,
    });
  },

  buscarReincidencia(query: ReincidenciaQuery): Promise<TriagemComRelacoes[]> {
    const serialNormalizado = normalizarSerial(query.serial);
    return triagensRepository.findReincidencia(serialNormalizado, query.excluirTriagemId);
  },

  async getTriagemById(id: number): Promise<TriagemDetailResponse> {
    const triagem = await getTriagemOrThrow(id);
    const respostas = await triagensRepository.findRespostasByTriagemId(id);
    const respondedItemIds = Array.from(new Set(respostas.map((r) => r.itemChecklistId)));
    const itensChecklist = await triagensRepository.findChecklistForTriagem(
      triagem.categoriaId,
      respondedItemIds,
    );

    return { triagem, itensChecklist, respostas };
  },

  async createTriagem(input: CreateTriagemInput, actorId: number): Promise<TriagemComRelacoes> {
    await ensureClienteExists(input.clienteId);
    await ensureCategoriaExists(input.categoriaId);

    return triagensRepository.create({
      clienteId: input.clienteId,
      categoriaId: input.categoriaId,
      recebidoPorId: actorId,
      modelo: input.modelo.trim(),
      fabricante: input.fabricante.trim(),
      numeroSerieMac: normalizarSerial(input.numeroSerieMac),
      statusSelo: input.statusSelo,
      observacaoSelo: normalizeOptionalText(input.observacaoSelo),
      defeitoReclamado: input.defeitoReclamado.trim(),
      acessoriosInclusos: normalizeOptionalText(input.acessoriosInclusos),
      status: 'PENDENTE',
    });
  },

  async updateTriagem(
    id: number,
    input: UpdateTriagemInput,
    actorId: number,
  ): Promise<TriagemComRelacoes> {
    const existing = await getTriagemOrThrow(id);
    ensureTriagemAberta(existing, 'Não é possível editar uma triagem já concluída ou cancelada.');

    if (input.clienteId !== undefined) {
      await ensureClienteExists(input.clienteId);
    }

    if (input.categoriaId !== undefined) {
      await ensureCategoriaExists(input.categoriaId);
    }

    const categoriaAlterada =
      input.categoriaId !== undefined && input.categoriaId !== existing.categoriaId;
    let deveLimparRespostas = false;

    if (categoriaAlterada) {
      const respostasSalvas = await triagensRepository.countRespostasByTriagemId(id);
      if (respostasSalvas > 0) {
        if (input.limparRespostasAnteriores !== true) {
          throw new AppError(
            'A triagem já possui respostas registradas no checklist. Confirme a limpeza das respostas anteriores para alterar a categoria.',
            409,
            'CHECKLIST_CONFIRM_CLEAR_REQUIRED',
          );
        }
        deveLimparRespostas = true;
      }
    }

    const updateData: Prisma.TriagemUncheckedUpdateInput = {
      ...(input.clienteId !== undefined ? { clienteId: input.clienteId } : {}),
      ...(input.categoriaId !== undefined ? { categoriaId: input.categoriaId } : {}),
      ...(input.modelo !== undefined ? { modelo: input.modelo.trim() } : {}),
      ...(input.fabricante !== undefined ? { fabricante: input.fabricante.trim() } : {}),
      ...(input.numeroSerieMac !== undefined
        ? { numeroSerieMac: normalizarSerial(input.numeroSerieMac) }
        : {}),
      ...(input.statusSelo !== undefined ? { statusSelo: input.statusSelo } : {}),
      ...(input.observacaoSelo !== undefined
        ? { observacaoSelo: normalizeOptionalText(input.observacaoSelo) }
        : {}),
      ...(input.defeitoReclamado !== undefined
        ? { defeitoReclamado: input.defeitoReclamado.trim() }
        : {}),
      ...(input.acessoriosInclusos !== undefined
        ? { acessoriosInclusos: normalizeOptionalText(input.acessoriosInclusos) }
        : {}),
      ultimaAtualizacaoPorId: actorId,
    };

    if (deveLimparRespostas) {
      return triagensRepository.updateClearingRespostas(id, updateData);
    }

    return triagensRepository.update(id, updateData);
  },

  async cancelarTriagem(id: number, actorId: number): Promise<TriagemComRelacoes> {
    const existing = await getTriagemOrThrow(id);
    ensureTriagemAberta(existing, 'Não é possível cancelar uma triagem já concluída ou cancelada.');

    return triagensRepository.update(id, {
      status: 'CANCELADA',
      canceladoPorId: actorId,
      canceladoEm: new Date(),
      ultimaAtualizacaoPorId: actorId,
    });
  },

  async iniciarAnalise(id: number, actorId: number): Promise<TriagemComRelacoes> {
    const existing = await getTriagemOrThrow(id);
    ensureTriagemAberta(
      existing,
      'Não é possível iniciar análise de uma triagem já concluída ou cancelada.',
    );

    if (existing.status === 'EM_ANALISE' && existing.analiseIniciadaPorId !== null) {
      return existing;
    }

    const now = new Date();
    return triagensRepository.update(id, {
      status: 'EM_ANALISE',
      ...buildInicioCampos(existing, actorId, now),
    });
  },

  async salvarProgresso(
    id: number,
    input: SalvarProgressoInput,
    actorId: number,
  ): Promise<TriagemComRespostas> {
    const existing = await getTriagemOrThrow(id);
    ensureTriagemAberta(
      existing,
      'Não é possível salvar progresso em uma triagem já concluída ou cancelada.',
    );

    const respostasInput = input.respostas ?? [];
    await validateRespostasBelongToCategoria(respostasInput, existing.categoriaId);

    const respostasToUpsert: RespostaUpsertPayload[] = respostasInput.map((item) => ({
      itemChecklistId: item.itemChecklistId,
      resultado: item.resultado,
      observacao: normalizeOptionalText(item.observacao),
    }));

    const now = new Date();
    const triagemData: Prisma.TriagemUncheckedUpdateInput = {
      status: 'EM_ANALISE',
      ...(existing.status === 'PENDENTE' || existing.analiseIniciadaPorId === null
        ? buildInicioCampos(existing, actorId, now)
        : {}),
      ...(input.diagnosticoFinal !== undefined ? { diagnosticoFinal: input.diagnosticoFinal } : {}),
      ...(input.parecerTecnico !== undefined
        ? { parecerTecnico: normalizeOptionalText(input.parecerTecnico) }
        : {}),
      ...(input.resumoCliente !== undefined
        ? { resumoCliente: normalizeOptionalText(input.resumoCliente) }
        : {}),
      ultimaAtualizacaoPorId: actorId,
    };

    return triagensRepository.persistRespostasAndUpdateTriagem({
      triagemId: id,
      actorId,
      respostas: respostasToUpsert,
      triagemData,
    });
  },

  async concluirTriagem(
    id: number,
    input: ConcluirTriagemInput,
    actorId: number,
  ): Promise<TriagemComRespostas> {
    const existing = await getTriagemOrThrow(id);
    ensureTriagemAberta(existing, 'Não é possível concluir uma triagem já concluída ou cancelada.');

    const respostasInput = input.respostas ?? [];
    await validateRespostasBelongToCategoria(respostasInput, existing.categoriaId);

    const [activeItems, existingRespostas] = await Promise.all([
      triagensRepository.findActiveChecklistByCategoria(existing.categoriaId),
      triagensRepository.findRespostasByTriagemId(id),
    ]);

    const existingByItemId = new Map(existingRespostas.map((r) => [r.itemChecklistId, r]));
    const submittedByItemId = new Map(respostasInput.map((r) => [r.itemChecklistId, r]));

    const effectiveResultadoByItemId = new Map<number, ResultadoItemChecklist>();
    for (const row of existingRespostas) {
      effectiveResultadoByItemId.set(row.itemChecklistId, row.resultado);
    }
    for (const item of respostasInput) {
      effectiveResultadoByItemId.set(item.itemChecklistId, item.resultado);
    }

    const incompleteActiveItems = activeItems.filter((item) => {
      const resultado = effectiveResultadoByItemId.get(item.id);
      return resultado !== 'APROVADO' && resultado !== 'REPROVADO';
    });

    if (incompleteActiveItems.length > 0) {
      if (input.diagnosticoFinal !== 'SEM_GARANTIA') {
        throw new AppError(
          'Todos os itens ativos do checklist devem ser avaliados (Aprovado ou Reprovado) antes de concluir o laudo.',
          400,
        );
      }

      if (existing.statusSelo === 'INTEGRO') {
        throw new AppError(
          'Não é permitido concluir como SEM_GARANTIA com itens pendentes quando o selo da loja está íntegro.',
          400,
        );
      }
    }

    const converterPendentesParaNaoTestado =
      input.diagnosticoFinal === 'SEM_GARANTIA' && existing.statusSelo !== 'INTEGRO';

    const respostasToUpsert: RespostaUpsertPayload[] = respostasInput.map((item) => ({
      itemChecklistId: item.itemChecklistId,
      resultado:
        converterPendentesParaNaoTestado && item.resultado === 'PENDENTE'
          ? 'NAO_TESTADO'
          : item.resultado,
      observacao: normalizeOptionalText(item.observacao),
    }));

    if (converterPendentesParaNaoTestado) {
      for (const activeItem of activeItems) {
        if (submittedByItemId.has(activeItem.id)) {
          continue;
        }
        const existingRow = existingByItemId.get(activeItem.id);
        if (!existingRow || existingRow.resultado === 'PENDENTE') {
          respostasToUpsert.push({
            itemChecklistId: activeItem.id,
            resultado: 'NAO_TESTADO',
            observacao: existingRow?.observacao ?? null,
          });
        }
      }
    }

    const itensReprovados = activeItems
      .filter((item) => effectiveResultadoByItemId.get(item.id) === 'REPROVADO')
      .map((item) => item.descricao);

    const parecerFinal =
      input.parecerTecnico !== undefined
        ? normalizeOptionalText(input.parecerTecnico)
        : existing.parecerTecnico;

    const resumoInformado = normalizeOptionalText(input.resumoCliente);
    const resumoFallback =
      input.resumoCliente === undefined ? normalizeOptionalText(existing.resumoCliente) : null;
    const resumoFinal =
      resumoInformado ??
      resumoFallback ??
      gerarResumoClienteSugestao({
        diagnosticoFinal: input.diagnosticoFinal,
        modelo: existing.modelo,
        fabricante: existing.fabricante,
        statusSelo: existing.statusSelo,
        observacaoSelo: existing.observacaoSelo,
        parecerTecnico: parecerFinal,
        itensReprovados,
      });

    const now = new Date();
    const triagemData: Prisma.TriagemUncheckedUpdateInput = {
      status: 'CONCLUIDA',
      diagnosticoFinal: input.diagnosticoFinal,
      parecerTecnico: parecerFinal,
      resumoCliente: resumoFinal,
      concluidoPorId: actorId,
      concluidoEm: now,
      ...buildInicioCampos(existing, actorId, now),
      ultimaAtualizacaoPorId: actorId,
    };

    return triagensRepository.persistRespostasAndUpdateTriagem({
      triagemId: id,
      actorId,
      respostas: respostasToUpsert,
      triagemData,
    });
  },

  async reabrirTriagem(id: number, actorId: number): Promise<TriagemComRelacoes> {
    const existing = await getTriagemOrThrow(id);
    if (existing.status !== 'CONCLUIDA') {
      throw new AppError('Somente triagens concluídas podem ser reabertas.', 409);
    }

    return triagensRepository.update(id, {
      status: 'EM_ANALISE',
      concluidoPorId: null,
      concluidoEm: null,
      ultimaAtualizacaoPorId: actorId,
    });
  },
};
