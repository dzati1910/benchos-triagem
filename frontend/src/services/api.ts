import type {
  Categoria,
  Cliente,
  DiagnosticoFinal,
  LoginResponse,
  MeResponse,
  ReincidenciaItem,
  ResultadoItemChecklist,
  StatusSelo,
  StatusTriagem,
  Triagem,
  TriagemComRespostas,
  TriagemDetalheResponse,
} from '../types';

export const API_BASE = '/api';
export const AUTH_TOKEN_STORAGE_KEY = 'benchos_token';

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

export function registerUnauthorizedHandler(cb: UnauthorizedHandler | null): void {
  unauthorizedHandler = cb;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const headers = new Headers(options.headers);
  const token = getAuthToken();

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (typeof options.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(`${API_BASE}${normalizedPath}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && !normalizedPath.startsWith('/auth/login')) {
    unauthorizedHandler?.();
  }

  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as
      | { error?: unknown; code?: unknown }
      | null;
    const message =
      payload && typeof payload.error === 'string' && payload.error.trim().length > 0
        ? payload.error
        : `Erro na requisição (${res.status})`;
    const code = payload && typeof payload.code === 'string' ? payload.code : undefined;
    throw new ApiError(message, res.status, code);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

export function loginRequest(email: string, senha: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, senha }),
  });
}

export function fetchMeRequest(): Promise<MeResponse> {
  return apiFetch<MeResponse>('/auth/me');
}

export interface ListTriagensParams {
  status?: StatusTriagem;
  busca?: string;
  incluirCanceladas?: boolean;
}

export interface CreateTriagemPayload {
  clienteId: number;
  categoriaId: number;
  modelo: string;
  fabricante: string;
  numeroSerieMac: string;
  statusSelo: StatusSelo;
  observacaoSelo?: string | null;
  defeitoReclamado: string;
  acessoriosInclusos?: string | null;
}

export interface UpdateTriagemPayload extends Partial<CreateTriagemPayload> {
  limparRespostasAnteriores?: boolean;
}

export interface CreateClientePayload {
  nome: string;
  telefone?: string | null;
  documento?: string | null;
}

export interface RespostaChecklistPayload {
  itemChecklistId: number;
  resultado: ResultadoItemChecklist;
  observacao?: string | null;
}

export interface SalvarProgressoPayload {
  respostas?: RespostaChecklistPayload[];
  diagnosticoFinal?: DiagnosticoFinal | null;
  parecerTecnico?: string | null;
  resumoCliente?: string | null;
}

export interface ConcluirTriagemPayload {
  diagnosticoFinal: DiagnosticoFinal;
  parecerTecnico?: string | null;
  resumoCliente?: string | null;
  respostas?: RespostaChecklistPayload[];
}

export function fetchTriagens(params: ListTriagensParams = {}): Promise<Triagem[]> {
  const search = new URLSearchParams();
  if (params.status) {
    search.set('status', params.status);
  }
  if (params.busca?.trim()) {
    search.set('busca', params.busca.trim());
  }
  if (params.incluirCanceladas) {
    search.set('incluirCanceladas', 'true');
  }
  const qs = search.toString();
  return apiFetch<Triagem[]>(qs ? `/triagens?${qs}` : '/triagens');
}

export function fetchReincidenciaSerial(
  serial: string,
  excluirTriagemId?: number,
): Promise<ReincidenciaItem[]> {
  const search = new URLSearchParams({ serial: serial.trim() });
  if (excluirTriagemId !== undefined) {
    search.set('excluirTriagemId', String(excluirTriagemId));
  }
  return apiFetch<ReincidenciaItem[]>(`/triagens/reincidencia?${search.toString()}`);
}

export function fetchTriagemDetalhe(id: number): Promise<TriagemDetalheResponse> {
  return apiFetch<TriagemDetalheResponse>(`/triagens/${id}`);
}

export function criarTriagem(data: CreateTriagemPayload): Promise<Triagem> {
  return apiFetch<Triagem>('/triagens', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function editarTriagem(id: number, data: UpdateTriagemPayload): Promise<Triagem> {
  return apiFetch<Triagem>(`/triagens/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function cancelarTriagem(id: number): Promise<Triagem> {
  return apiFetch<Triagem>(`/triagens/${id}/cancelar`, {
    method: 'PATCH',
  });
}

export function iniciarAnaliseTriagem(id: number): Promise<Triagem> {
  return apiFetch<Triagem>(`/triagens/${id}/iniciar`, {
    method: 'PATCH',
  });
}

export function salvarProgressoTriagem(
  id: number,
  data: SalvarProgressoPayload,
): Promise<TriagemComRespostas> {
  return apiFetch<TriagemComRespostas>(`/triagens/${id}/progresso`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function concluirTriagem(
  id: number,
  data: ConcluirTriagemPayload,
): Promise<TriagemComRespostas> {
  return apiFetch<TriagemComRespostas>(`/triagens/${id}/concluir`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function reabrirTriagem(id: number): Promise<Triagem> {
  return apiFetch<Triagem>(`/triagens/${id}/reabrir`, {
    method: 'PATCH',
  });
}

export function fetchCategorias(incluirInativos = false): Promise<Categoria[]> {
  const path = incluirInativos ? '/categorias?incluirInativos=true' : '/categorias';
  return apiFetch<Categoria[]>(path);
}

export function fetchClientes(busca?: string): Promise<Cliente[]> {
  const trimmed = busca?.trim();
  const path = trimmed ? `/clientes?busca=${encodeURIComponent(trimmed)}` : '/clientes';
  return apiFetch<Cliente[]>(path);
}

export function criarCliente(data: CreateClientePayload): Promise<Cliente> {
  return apiFetch<Cliente>('/clientes', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}
