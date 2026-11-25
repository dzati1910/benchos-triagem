import type {
  DiagnosticoFinal,
  ResultadoItemChecklist,
  StatusSelo,
  StatusTriagem,
} from '../../types';

export const STATUS_SELO_LABELS: Record<StatusSelo, string> = {
  INTEGRO: 'Selo Íntegro',
  VIOLADO: 'Selo Violado',
  SEM_SELO: 'Sem Selo',
};

export const STATUS_SELO_DESCRICOES: Record<StatusSelo, string> = {
  INTEGRO: 'Lacre da loja intacto, sem sinais de abertura ou violação.',
  VIOLADO: 'Lacre rompido, rasurado ou com indícios de abertura externa.',
  SEM_SELO: 'Equipamento deu entrada sem etiqueta/selo de garantia da loja.',
};

export const STATUS_TRIAGEM_LABELS: Record<StatusTriagem, string> = {
  PENDENTE: 'Aguardando Bancada',
  EM_ANALISE: 'Em Análise',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
};

export const DIAGNOSTICO_FINAL_LABELS: Record<DiagnosticoFinal, string> = {
  OPERACIONAL: 'Operacional',
  DEFEITO_FABRICA: 'Defeito de Fábrica',
  ENCAMINHAR_ESPECIALISTA: 'Encaminhar ao Especialista',
  SEM_GARANTIA: 'Sem Garantia',
};

export const RESULTADO_ITEM_LABELS: Record<ResultadoItemChecklist, string> = {
  PENDENTE: 'Pendente',
  APROVADO: 'Aprovado',
  REPROVADO: 'Reprovado',
  NAO_TESTADO: 'Não Testado',
};

export interface ChecklistItemSugestaoInput {
  descricao: string;
  resultado: ResultadoItemChecklist;
  observacao?: string | null;
}

export interface SugerirDiagnosticoParams {
  statusSelo: StatusSelo;
  fabricante?: string;
  modelo?: string;
  observacaoSelo?: string | null;
  itens: ChecklistItemSugestaoInput[];
  diagnosticoOverride?: DiagnosticoFinal;
}

export interface SugestaoDiagnosticoResult {
  diagnosticoFinal: DiagnosticoFinal;
  parecerTecnico: string;
  resumoCliente: string;
}

export interface ResumoWhatsAppInput {
  id: number;
  fabricante: string;
  modelo: string;
  numeroSerieMac: string;
  statusSelo: StatusSelo;
  diagnosticoFinal?: DiagnosticoFinal | null;
  resumoCliente?: string | null;
  cliente?: { nome: string } | null;
}

/**
 * Normaliza entrada manual de número de série ou endereço MAC para exibição e envio à API.
 */
export function normalizarSerialInput(raw: string): string {
  return raw.trim().toUpperCase();
}

export function formatarStatusSelo(statusSelo: StatusSelo): string {
  return STATUS_SELO_LABELS[statusSelo];
}

export function formatarStatusTriagem(status: StatusTriagem): string {
  return STATUS_TRIAGEM_LABELS[status];
}

export function formatarDiagnosticoFinal(diagnostico: DiagnosticoFinal): string {
  return DIAGNOSTICO_FINAL_LABELS[diagnostico];
}

export function formatarResultadoItem(resultado: ResultadoItemChecklist): string {
  return RESULTADO_ITEM_LABELS[resultado];
}

/**
 * Indica se a troca de categoria no modal de edição exige confirmação prévia por poder limpar respostas.
 */
export function precisaConfirmarTrocaCategoria(
  status: StatusTriagem,
  originalCategoriaId: number | null | undefined,
  novaCategoriaId: number,
): boolean {
  return (
    status === 'EM_ANALISE' &&
    originalCategoriaId != null &&
    novaCategoriaId !== originalCategoriaId
  );
}

export function isTriagemAberta(status: StatusTriagem): boolean {
  return status === 'PENDENTE' || status === 'EM_ANALISE';
}

export function isCategoriaArmazenamento(categoriaNome?: string | null): boolean {
  if (!categoriaNome) {
    return false;
  }
  const normalized = categoriaNome.toLowerCase();
  return (
    normalized.includes('hd') ||
    normalized.includes('ssd') ||
    normalized.includes('disco') ||
    normalized.includes('armazenamento') ||
    normalized.includes('storage')
  );
}

export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) {
    return '-';
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function formatarNomeEquipamento(fabricante?: string, modelo?: string): string {
  const nome = [fabricante?.trim(), modelo?.trim()].filter(Boolean).join(' ');
  return nome || 'equipamento';
}

function formatarObservacoesTecnicas(itens: ChecklistItemSugestaoInput[]): string[] {
  return itens
    .filter((item) => Boolean(item.observacao?.trim()))
    .map((item) => `${item.descricao}: ${item.observacao?.trim()}`);
}

function inferirDiagnostico(
  statusSelo: StatusSelo,
  itens: ChecklistItemSugestaoInput[],
): DiagnosticoFinal {
  if (statusSelo !== 'INTEGRO') {
    return 'SEM_GARANTIA';
  }
  if (itens.some((item) => item.resultado === 'REPROVADO')) {
    return 'DEFEITO_FABRICA';
  }
  if (itens.length > 0 && itens.every((item) => item.resultado === 'APROVADO')) {
    return 'OPERACIONAL';
  }
  return 'ENCAMINHAR_ESPECIALISTA';
}

/**
 * Sugere diagnóstico final, parecer técnico interno e resumo legível para atendimento ao cliente.
 */
export function sugerirDiagnosticoEResumo(
  params: SugerirDiagnosticoParams,
): SugestaoDiagnosticoResult {
  const diagnosticoFinal =
    params.diagnosticoOverride ?? inferirDiagnostico(params.statusSelo, params.itens);
  const equipamento = formatarNomeEquipamento(params.fabricante, params.modelo);
  const notas = formatarObservacoesTecnicas(params.itens);
  const aprovados = params.itens.filter((i) => i.resultado === 'APROVADO').map((i) => i.descricao);
  const reprovados = params.itens.filter((i) => i.resultado === 'REPROVADO').map((i) => i.descricao);

  if (diagnosticoFinal === 'OPERACIONAL') {
    const parecerBase =
      aprovados.length > 0
        ? `Equipamento aprovado em todos os testes de bancada (${aprovados.join(', ')}), sem reprodução do defeito reclamado.`
        : 'Equipamento aprovado nos testes de bancada sem anomalias constatadas.';
    const parecerTecnico = notas.length > 0 ? `${parecerBase} Observações: ${notas.join(' | ')}.` : parecerBase;
    const resumoCliente =
      `O equipamento (${equipamento}) foi testado em nossa bancada técnica e apresentou funcionamento normal ` +
      `nos testes realizados. Recomendamos conferir fonte de alimentação, conectores e cabeamento na instalação no local.`;
    return { diagnosticoFinal, parecerTecnico, resumoCliente };
  }

  if (diagnosticoFinal === 'DEFEITO_FABRICA') {
    const falhasTexto =
      reprovados.length > 0 ? reprovados.join('; ') : 'falha funcional identificada em bancada';
    const parecerBase = `Reprovado nos testes de bancada (${falhasTexto}).`;
    const parecerTecnico = notas.length > 0 ? `${parecerBase} Registros: ${notas.join(' | ')}.` : parecerBase;
    const detalheCliente =
      reprovados.length > 0 ? ` (falha constatada em: ${reprovados.join('; ')})` : '';
    const resumoCliente =
      `Após testes diretos em nossa bancada técnica, o equipamento (${equipamento}) apresentou irregularidade funcional` +
      `${detalheCliente}, compatível com defeito de fabricação e apto para tratativa de garantia conforme política da loja.`;
    return { diagnosticoFinal, parecerTecnico, resumoCliente };
  }

  if (diagnosticoFinal === 'ENCAMINHAR_ESPECIALISTA') {
    const parecerBase = 'Testes iniciais de bancada inconclusivos ou com demanda de análise técnica avançada por especialista.';
    const parecerTecnico = notas.length > 0 ? `${parecerBase} Notas de bancada: ${notas.join(' | ')}.` : parecerBase;
    const resumoCliente =
      `O equipamento (${equipamento}) passou por avaliação inicial em nossa bancada e será encaminhado ao técnico especialista ` +
      `para análise técnica avançada antes da definição final do atendimento.`;
    return { diagnosticoFinal, parecerTecnico, resumoCliente };
  }

  const labelSelo = formatarStatusSelo(params.statusSelo);
  const obsSelo = params.observacaoSelo?.trim() ? ` (${params.observacaoSelo.trim()})` : '';
  const parecerBase = `Equipamento inelegível para garantia devido à condição do lacre: ${labelSelo}${obsSelo}.`;
  const parecerTecnico = notas.length > 0 ? `${parecerBase} Observações: ${notas.join(' | ')}.` : parecerBase;
  const motivoCliente =
    params.statusSelo === 'VIOLADO'
      ? 'ao selo de garantia da loja violado'
      : params.statusSelo === 'SEM_SELO'
        ? 'à ausência do selo de garantia da loja'
        : 'às condições de elegibilidade de garantia da loja';
  const resumoCliente =
    `O equipamento (${equipamento}) não é elegível para garantia devido ${motivoCliente}. ` +
    `Caso deseje, nossa equipe comercial pode auxiliar com opções de reposição ou orçamento.`;
  return { diagnosticoFinal, parecerTecnico, resumoCliente };
}

/**
 * Formata resumo pronto para envio ao cliente via WhatsApp sem expor jargões técnicos internos.
 */
export function formatarResumoWhatsApp(triagem: ResumoWhatsAppInput): string {
  const equipamento = formatarNomeEquipamento(triagem.fabricante, triagem.modelo);
  const linhas: string[] = [
    `*Resumo de Atendimento - OS #${triagem.id}*`,
    ...(triagem.cliente?.nome ? [`Cliente: ${triagem.cliente.nome}`] : []),
    `Equipamento: ${equipamento}`,
    `Serial/MAC: ${triagem.numeroSerieMac}`,
    `Selo de Garantia: ${formatarStatusSelo(triagem.statusSelo)}`,
  ];

  if (triagem.diagnosticoFinal) {
    linhas.push(`Resultado: ${formatarDiagnosticoFinal(triagem.diagnosticoFinal)}`);
  }

  const resumo =
    triagem.resumoCliente?.trim() ||
    'Seu atendimento foi registrado em nossa bancada técnica. Em caso de dúvidas, fale com nossa equipe.';

  linhas.push('', resumo);
  return linhas.join('\n');
}
