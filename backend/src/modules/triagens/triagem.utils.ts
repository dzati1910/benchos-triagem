import type { DiagnosticoFinal, StatusSelo } from '@prisma/client';

export interface GerarResumoClienteParams {
  diagnosticoFinal: DiagnosticoFinal;
  modelo?: string;
  fabricante?: string;
  statusSelo?: StatusSelo;
  observacaoSelo?: string | null;
  parecerTecnico?: string | null;
  itensReprovados?: string[];
}

/**
 * Normaliza o número de série ou endereço MAC removendo espaços nas pontas e convertendo para maiúsculas.
 */
export function normalizarSerial(raw: string): string {
  return raw.trim().toUpperCase();
}

function formatarEquipamento(fabricante?: string, modelo?: string): string {
  const nome = [fabricante?.trim(), modelo?.trim()].filter(Boolean).join(' ');
  return nome || 'equipamento';
}

function descreverMotivoSelo(statusSelo?: StatusSelo): string {
  if (statusSelo === 'VIOLADO') {
    return 'ao selo de garantia da loja violado';
  }
  if (statusSelo === 'SEM_SELO') {
    return 'à ausência do selo de garantia da loja';
  }
  return 'às condições de elegibilidade de garantia da loja';
}

/**
 * Gera sugestão inicial de resumo legível para atendimento ao cliente no balcão/WhatsApp.
 */
export function gerarResumoClienteSugestao(params: GerarResumoClienteParams): string {
  const equipamento = formatarEquipamento(params.fabricante, params.modelo);

  switch (params.diagnosticoFinal) {
    case 'OPERACIONAL':
      return (
        `O equipamento (${equipamento}) foi testado em nossa bancada técnica e apresentou funcionamento normal ` +
        `nos testes realizados. Recomendamos conferir fonte de alimentação, conectores e cabeamento na instalação no local.`
      );

    case 'DEFEITO_FABRICA': {
      const falhas = (params.itensReprovados ?? []).map((item) => item.trim()).filter(Boolean);
      const detalheFalhas =
        falhas.length > 0 ? ` (falha constatada em: ${falhas.join('; ')})` : '';
      return (
        `Após testes diretos em nossa bancada técnica, o equipamento (${equipamento}) apresentou irregularidade funcional${detalheFalhas} ` +
        `compatível com defeito de fabricação, estando apto para tratativa de garantia conforme política da loja.`
      );
    }

    case 'ENCAMINHAR_ESPECIALISTA':
      return (
        `O equipamento (${equipamento}) passou por avaliação inicial em nossa bancada e será encaminhado ao técnico especialista ` +
        `para análise aprofundada antes da definição final do atendimento.`
      );

    case 'SEM_GARANTIA': {
      const motivo = descreverMotivoSelo(params.statusSelo);
      return (
        `O equipamento (${equipamento}) não é elegível para garantia devido ${motivo}. ` +
        `Caso deseje, nossa equipe comercial pode auxiliar com opções de reposição ou orçamento.`
      );
    }
  }
}
