export type Role = 'ADMIN' | 'FUNCIONARIO';

export type StatusSelo = 'INTEGRO' | 'VIOLADO' | 'SEM_SELO';

export type StatusTriagem = 'PENDENTE' | 'EM_ANALISE' | 'CONCLUIDA' | 'CANCELADA';

export type DiagnosticoFinal =
  | 'OPERACIONAL'
  | 'DEFEITO_FABRICA'
  | 'ENCAMINHAR_ESPECIALISTA'
  | 'SEM_GARANTIA';

export type ResultadoItemChecklist =
  | 'PENDENTE'
  | 'APROVADO'
  | 'REPROVADO'
  | 'NAO_TESTADO';

export interface PublicUser {
  id: number;
  nome: string;
  email: string;
  role: Role;
  ativo: boolean;
  criadoEm: string;
}

export interface TriagemUserRef {
  id: number;
  nome: string;
  email: string;
  role: Role;
}

export interface Cliente {
  id: number;
  nome: string;
  telefone: string | null;
  documento: string | null;
  criadoEm: string;
}

export interface ItemChecklist {
  id: number;
  categoriaId: number;
  descricao: string;
  comoTestar: string;
  ordem: number;
  ativo: boolean;
}

export interface Categoria {
  id: number;
  nome: string;
  icone: string;
  instrucaoGeral: string | null;
  ativo: boolean;
  itens?: ItemChecklist[];
}

export interface Triagem {
  id: number;
  clienteId: number;
  cliente: Cliente;
  categoriaId: number;
  categoria: Categoria;
  recebidoPorId: number;
  recebidoPor: TriagemUserRef;
  analiseIniciadaPorId: number | null;
  analiseIniciadaPor: TriagemUserRef | null;
  concluidoPorId: number | null;
  concluidoPor: TriagemUserRef | null;
  canceladoPorId: number | null;
  canceladoPor: TriagemUserRef | null;
  ultimaAtualizacaoPorId: number | null;
  ultimaAtualizacaoPor: TriagemUserRef | null;
  modelo: string;
  fabricante: string;
  numeroSerieMac: string;
  statusSelo: StatusSelo;
  observacaoSelo: string | null;
  defeitoReclamado: string;
  acessoriosInclusos: string | null;
  status: StatusTriagem;
  diagnosticoFinal: DiagnosticoFinal | null;
  parecerTecnico: string | null;
  resumoCliente: string | null;
  criadoEm: string;
  analiseIniciadaEm: string | null;
  concluidoEm: string | null;
  canceladoEm: string | null;
  atualizadoEm: string;
}

export interface TriagemResposta {
  id: number;
  triagemId: number;
  itemChecklistId: number;
  resultado: ResultadoItemChecklist;
  observacao: string | null;
  respondidoPorId: number | null;
  respondidoPor: TriagemUserRef | null;
  atualizadoEm: string;
}

export interface TriagemDetalheResponse {
  triagem: Triagem;
  itensChecklist: ItemChecklist[];
  respostas: TriagemResposta[];
}

export type ReincidenciaItem = Triagem;

export interface LoginResponse {
  token: string;
  user: PublicUser;
}

export interface MeResponse {
  user: PublicUser;
}
