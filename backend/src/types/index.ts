export interface Cliente {
  id: number;
  nome: string;
  telefone?: string;
  documento?: string;
  criado_em: string;
}

export interface Categoria {
  id: number;
  nome: string;
  icone: string;
}

export interface ItemChecklist {
  id: number;
  categoria_id: number;
  descricao: string;
  ordem: number;
}

export type StatusTriagem = 'PENDENTE' | 'EM_ANALISE' | 'CONCLUIDO';
export type DiagnosticoFinal = 'OPERACIONAL' | 'DEFEITO_FABRICA' | 'MAU_USO';

export interface Triagem {
  id: number;
  cliente_id: number;
  cliente_nome?: string;
  cliente_telefone?: string;
  categoria_id: number;
  categoria_nome?: string;
  modelo: string;
  fabricante: string;
  numero_serie_mac: string;
  defeito_reclamado: string;
  acessorios_inclusos?: string;
  tecnico_responsavel?: string;
  status: StatusTriagem;
  diagnostico_final?: DiagnosticoFinal;
  parecer_tecnico?: string;
  criado_em: string;
  concluido_em?: string;
}

export interface RespostaChecklistInput {
  item_checklist_id: number;
  passou: boolean;
  observacao?: string;
}

export interface ConcluirTriagemInput {
  diagnostico_final: DiagnosticoFinal;
  parecer_tecnico: string;
  tecnico_responsavel: string;
  respostas: RespostaChecklistInput[];
}
