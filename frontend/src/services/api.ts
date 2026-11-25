import { Categoria, Cliente, Triagem, TriagemDetalheResponse } from '../types';

const API_BASE = 'http://localhost:3001/api';

export async function fetchTriagens(busca?: string, status?: string): Promise<Triagem[]> {
  const params = new URLSearchParams();
  if (busca) params.append('busca', busca);
  if (status) params.append('status', status);

  const res = await fetch(`${API_BASE}/triagens?${params.toString()}`);
  if (!res.ok) throw new Error('Falha ao carregar triagens');
  return res.json();
}

export async function fetchTriagemDetalhe(id: number): Promise<TriagemDetalheResponse> {
  const res = await fetch(`${API_BASE}/triagens/${id}`);
  if (!res.ok) throw new Error('Falha ao carregar detalhes da triagem');
  return res.json();
}

export async function fetchCategorias(): Promise<Categoria[]> {
  const res = await fetch(`${API_BASE}/categorias`);
  if (!res.ok) throw new Error('Falha ao carregar categorias');
  return res.json();
}

export async function fetchClientes(): Promise<Cliente[]> {
  const res = await fetch(`${API_BASE}/clientes`);
  if (!res.ok) throw new Error('Falha ao carregar clientes');
  return res.json();
}

export async function criarCliente(nome: string, telefone?: string, documento?: string): Promise<Cliente> {
  const res = await fetch(`${API_BASE}/clientes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nome, telefone, documento }),
  });
  if (!res.ok) throw new Error('Falha ao cadastrar cliente');
  return res.json();
}

export async function criarTriagem(dados: {
  cliente_id: number;
  categoria_id: number;
  modelo: string;
  fabricante: string;
  numero_serie_mac: string;
  defeito_reclamado: string;
  acessorios_inclusos?: string;
  tecnico_responsavel?: string;
}): Promise<{ id: number }> {
  const res = await fetch(`${API_BASE}/triagens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });
  if (!res.ok) throw new Error('Falha ao cadastrar triagem');
  return res.json();
}

export async function concluirTriagem(
  id: number,
  dados: {
    diagnostico_final: string;
    parecer_tecnico: string;
    tecnico_responsavel: string;
    respostas: Array<{ item_checklist_id: number; passou: boolean; observacao?: string }>;
  }
): Promise<{ message: string }> {
  const res = await fetch(`${API_BASE}/triagens/${id}/concluir`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });
  if (!res.ok) throw new Error('Falha ao concluir triagem');
  return res.json();
}
