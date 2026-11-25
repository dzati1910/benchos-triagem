export interface Cliente {
  id: number;
  nome: string;
  telefone?: string;
  documento?: string;
}

export interface ItemChecklist {
  id: number;
  categoria_id: number;
  descricao: string;
  ordem: number;
}

export interface Categoria {
  id: number;
  nome: string;
  icone: string;
  checklists?: ItemChecklist[];
}

export type StatusTriagem = 'PENDENTE' | 'EM_ANALISE' | 'CONCLUIDO';
export type DiagnosticoFinal = 'OPERACIONAL' | 'DEFEITO_FABRICA' | 'MAU_USO';

export interface Triagem {
  id: number;
  cliente_id: number;
  cliente_nome: string;
  cliente_telefone?: string;
  categoria_id: number;
  categoria_nome: string;
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

export interface TriagemDetalheResponse {
  triagem: Triagem;
  itensChecklist: ItemChecklist[];
  respostas: Array<{
    id: number;
    triagem_id: number;
    item_checklist_id: number;
    passou: number;
    observacao?: string;
  }>;
}
