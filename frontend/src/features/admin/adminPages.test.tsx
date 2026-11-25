import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Categoria, PublicUser } from '../../types';
import { ChecklistsAdminPage } from './ChecklistsAdminPage';
import { UsuariosAdminPage } from './UsuariosAdminPage';

const mockUserRef = vi.hoisted(() => ({ current: null as PublicUser | null }));

const apiMocks = vi.hoisted(() => ({
  fetchUsers: vi.fn(),
  criarUsuario: vi.fn(),
  atualizarUsuario: vi.fn(),
  redefinirSenhaUsuario: vi.fn(),
  fetchCategoriasAdmin: vi.fn(),
  criarCategoria: vi.fn(),
  atualizarCategoria: vi.fn(),
  criarItemChecklist: vi.fn(),
  atualizarItemChecklist: vi.fn(),
}));

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUserRef.current,
    token: 'tok-admin',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('../../services/api', () => apiMocks);

function makeUsers(): PublicUser[] {
  return [
    {
      id: 1,
      nome: 'Administrador BenchOS',
      email: 'admin@benchos.local',
      role: 'ADMIN',
      ativo: true,
      criadoEm: '2026-11-25T10:00:00.000Z',
    },
    {
      id: 2,
      nome: 'Carlos Técnico',
      email: 'carlos@benchos.local',
      role: 'FUNCIONARIO',
      ativo: true,
      criadoEm: '2026-11-25T10:30:00.000Z',
    },
  ];
}

function makeCategorias(): Categoria[] {
  return [
    {
      id: 10,
      nome: 'HD (Disco Rígido CFTV)',
      icone: 'HardDrive',
      instrucaoGeral: 'Priorize leitura S.M.A.R.T. no PC de bancada.',
      ativo: true,
      itens: [
        {
          id: 101,
          categoriaId: 10,
          descricao: 'Leitura S.M.A.R.T. no PC de bancada',
          comoTestar: 'Abrir CrystalDiskInfo e conferir setores realocados e horas de uso.',
          ordem: 1,
          ativo: true,
        },
      ],
    },
    {
      id: 11,
      nome: 'Câmera Legada',
      icone: 'Camera',
      instrucaoGeral: null,
      ativo: false,
      itens: [],
    },
  ];
}

describe('Telas Admin (UsuariosAdminPage e ChecklistsAdminPage)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRef.current = {
      id: 1,
      nome: 'Administrador BenchOS',
      email: 'admin@benchos.local',
      role: 'ADMIN',
      ativo: true,
      criadoEm: '2026-11-25T10:00:00.000Z',
    };
  });

  afterEach(() => {
    cleanup();
  });

  it('UsuariosAdminPage desabilita autodesativação/rebaixamento na própria linha e cria novo funcionário', async () => {
    const users = makeUsers();
    const novoUsuario: PublicUser = {
      id: 3,
      nome: 'Mariana Balcão',
      email: 'mariana@benchos.local',
      role: 'FUNCIONARIO',
      ativo: true,
      criadoEm: '2026-11-25T12:00:00.000Z',
    };

    apiMocks.fetchUsers.mockResolvedValueOnce(users);
    apiMocks.criarUsuario.mockResolvedValueOnce(novoUsuario);
    apiMocks.atualizarUsuario.mockResolvedValueOnce({ ...users[1], ativo: false });

    render(<UsuariosAdminPage />);

    expect(await screen.findByText('Administrador BenchOS')).toBeTruthy();
    expect(screen.getByText('Carlos Técnico')).toBeTruthy();

    // Na própria linha do admin logado, Desativar e select de Papel ficam desabilitados
    const desativarButtons = screen.getAllByRole('button', { name: /Desativar/i }) as HTMLButtonElement[];
    expect(desativarButtons[0].disabled).toBe(true);
    expect(desativarButtons[1].disabled).toBe(false);

    const selfRoleSelect = screen.getByLabelText('Papel de Administrador BenchOS') as HTMLSelectElement;
    const otherRoleSelect = screen.getByLabelText('Papel de Carlos Técnico') as HTMLSelectElement;
    expect(selfRoleSelect.disabled).toBe(true);
    expect(otherRoleSelect.disabled).toBe(false);

    // Abrir formulário e cadastrar novo funcionário
    fireEvent.click(screen.getByRole('button', { name: /Novo Funcionário/i }));
    fireEvent.change(screen.getByLabelText(/Nome completo/i), {
      target: { value: 'Mariana Balcão' },
    });
    fireEvent.change(screen.getByLabelText(/E-mail corporativo/i), {
      target: { value: 'mariana@benchos.local' },
    });
    fireEvent.change(screen.getByLabelText(/Senha inicial/i), {
      target: { value: 'Senha@123' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Salvar Funcionário/i }));

    await waitFor(() => {
      expect(apiMocks.criarUsuario).toHaveBeenCalledWith({
        nome: 'Mariana Balcão',
        email: 'mariana@benchos.local',
        senha: 'Senha@123',
        role: 'FUNCIONARIO',
      });
    });

    expect(await screen.findByText('Mariana Balcão')).toBeTruthy();
  });

  it('ChecklistsAdminPage lista categorias/itens com comoTestar e cria novo item de checklist', async () => {
    const iniciais = makeCategorias();
    const novoItem = {
      id: 102,
      categoriaId: 10,
      descricao: 'Teste de gravação contínua',
      comoTestar: 'Formatar no DVR de teste e gravar por 10 minutos.',
      ordem: 2,
      ativo: true,
    };
    const atualizadas: Categoria[] = [
      {
        ...iniciais[0],
        itens: [...(iniciais[0].itens ?? []), novoItem],
      },
      iniciais[1],
    ];

    apiMocks.fetchCategoriasAdmin
      .mockResolvedValueOnce(iniciais)
      .mockResolvedValueOnce(atualizadas);
    apiMocks.criarItemChecklist.mockResolvedValueOnce(novoItem);

    render(<ChecklistsAdminPage />);

    expect(await screen.findByText('Leitura S.M.A.R.T. no PC de bancada')).toBeTruthy();
    expect(
      screen.getByText(/Abrir CrystalDiskInfo e conferir setores realocados/i),
    ).toBeTruthy();
    expect(screen.getByText('Câmera Legada')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Novo Item/i }));
    fireEvent.change(screen.getByLabelText(/Descrição do ponto de verificação/i), {
      target: { value: 'Teste de gravação contínua' },
    });
    fireEvent.change(screen.getByLabelText(/Como testar na bancada/i), {
      target: { value: 'Formatar no DVR de teste e gravar por 10 minutos.' },
    });
    fireEvent.change(screen.getByLabelText(/Ordem \(opcional\)/i), {
      target: { value: '2' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Adicionar Item/i }));

    await waitFor(() => {
      expect(apiMocks.criarItemChecklist).toHaveBeenCalledWith(10, {
        descricao: 'Teste de gravação contínua',
        comoTestar: 'Formatar no DVR de teste e gravar por 10 minutos.',
        ordem: 2,
      });
    });

    expect(await screen.findByText('Teste de gravação contínua')).toBeTruthy();
  });
});
