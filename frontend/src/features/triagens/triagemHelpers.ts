import type { DiagnosticoFinal, StatusSelo, StatusTriagem } from '../../types';

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
