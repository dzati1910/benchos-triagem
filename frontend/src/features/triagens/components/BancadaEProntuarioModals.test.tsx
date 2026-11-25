import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PublicUser, Triagem, TriagemDetalheResponse } from '../../../types';
import { BancadaChecklistModal } from './BancadaChecklistModal';
import { ProntuarioResumoModal } from './ProntuarioResumoModal';

const mockUserRef = vi.hoisted(() => ({ current: null as PublicUser | null }));

const apiMocks = vi.hoisted(() => ({
  iniciarAnaliseTriagem: vi.fn(),
  fetchTriagemDetalhe: vi.fn(),
  salvarProgressoTriagem: vi.fn(),
  concluirTriagem: vi.fn(),
  reabrirTriagem: vi.fn(),
}));

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({
    user: mockUserRef.current,
    token: 'tok',
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

vi.mock('../../../services/api', () => apiMocks);

function makeTriagem(overrides: Partial<Triagem> = {}): Triagem {
  return {
    id: 15,
    clienteId: 1,
    cliente: {
      id: 1,
      nome: 'Distribuidora Alfa',
      telefone: '11999999999',
      documento: '12345678000100',
      criadoEm: '2026-11-25T10:00:00.000Z',
    },
    categoriaId: 2,
    categoria: {
      id: 2,
      nome: 'HD / Armazenamento',
      icone: 'HardDrive',
      instrucaoGeral: 'Conectar na doca USB 3.0 / SATA e validar S.M.A.R.T.',
      ativo: true,
    },
    recebidoPorId: 10,
    recebidoPor: { id: 10, nome: 'Carlos Balcão', email: 'c@b.local', role: 'FUNCIONARIO' },
    analiseIniciadaPorId: 11,
    analiseIniciadaPor: { id: 11, nome: 'Ana Bancada', email: 'a@b.local', role: 'FUNCIONARIO' },
    concluidoPorId: null,
    concluidoPor: null,
    canceladoPorId: null,
    canceladoPor: null,
    ultimaAtualizacaoPorId: null,
    ultimaAtualizacaoPor: null,
    modelo: 'SkyHawk 2TB',
    fabricante: 'Seagate',
    numeroSerieMac: 'ST2000VX008',
    statusSelo: 'INTEGRO',
    observacaoSelo: null,
    defeitoReclamado: 'Não reconhece no DVR',
    acessoriosInclusos: 'Sem acessórios',
    status: 'EM_ANALISE',
    diagnosticoFinal: null,
    parecerTecnico: null,
    resumoCliente: null,
    criadoEm: '2026-11-25T10:00:00.000Z',
    analiseIniciadaEm: '2026-11-25T10:15:00.000Z',
    concluidoEm: null,
    canceladoEm: null,
    atualizadoEm: '2026-11-25T10:15:00.000Z',
    ...overrides,
  };
}

function makeDetalhe(triagem: Triagem): TriagemDetalheResponse {
  return {
    triagem,
    itensChecklist: [
      {
        id: 101,
        categoriaId: 2,
        descricao: 'Detecção física SATA',
        comoTestar: 'Conectar na porta SATA e conferir se aparece na BIOS/SO.',
        ordem: 1,
        ativo: true,
      },
      {
        id: 102,
        categoriaId: 2,
        descricao: 'Saúde S.M.A.R.T.',
        comoTestar: 'Abrir CrystalDiskInfo e verificar setores realocados e horas de uso.',
        ordem: 2,
        ativo: true,
      },
    ],
    respostas: [],
  };
}

describe('BancadaChecklistModal e ProntuarioResumoModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserRef.current = {
      id: 11,
      nome: 'Ana Bancada',
      email: 'a@b.local',
      role: 'FUNCIONARIO',
      ativo: true,
      criadoEm: '2026-11-25T09:00:00.000Z',
    };
  });

  afterEach(() => {
    cleanup();
  });

  it('inicia análise quando OS está PENDENTE, exibe comoTestar, salva progresso parcial e valida conclusão', async () => {
    const pendente = makeTriagem({ status: 'PENDENTE', analiseIniciadaPor: null, analiseIniciadaPorId: null });
    const iniciada = makeTriagem({ status: 'EM_ANALISE' });

    apiMocks.iniciarAnaliseTriagem.mockResolvedValueOnce(iniciada);
    apiMocks.fetchTriagemDetalhe.mockResolvedValue(makeDetalhe(iniciada));
    apiMocks.salvarProgressoTriagem.mockResolvedValue(iniciada);

    const onSaved = vi.fn();
    const onAnaliseIniciada = vi.fn();

    render(
      <BancadaChecklistModal
        isOpen
        triagem={pendente}
        onClose={vi.fn()}
        onSaved={onSaved}
        onAnaliseIniciada={onAnaliseIniciada}
      />,
    );

    await waitFor(() => {
      expect(apiMocks.iniciarAnaliseTriagem).toHaveBeenCalledWith(15);
    });
    expect(onAnaliseIniciada).toHaveBeenCalledTimes(1);

    expect(await screen.findByText(/Conectar na porta SATA e conferir/i)).toBeTruthy();
    expect(screen.getByText('Carlos Balcão')).toBeTruthy();
    expect(screen.getByText('Ana Bancada')).toBeTruthy();

    // Marca apenas o primeiro item como OK e salva progresso parcial
    const okButtons = screen.getAllByRole('button', { name: 'OK' });
    fireEvent.click(okButtons[0]);

    const obsInput = screen.getByLabelText('Observação para Saúde S.M.A.R.T.');
    expect(obsInput.getAttribute('placeholder')).toContain('S.M.A.R.T.');

    // Com item pendente, Concluir Laudo permanece desabilitado mesmo selecionando SEM_GARANTIA com selo íntegro
    fireEvent.click(screen.getByRole('button', { name: /Sem Garantia/i }));
    expect(screen.getByText(/Este equipamento possui/i)).toBeTruthy();
    expect((screen.getByRole('button', { name: /Concluir Laudo/i }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /Salvar Progresso/i }));
    await waitFor(() => {
      expect(apiMocks.salvarProgressoTriagem).toHaveBeenCalledTimes(1);
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('permite concluir SEM_GARANTIA com itens pendentes quando selo está VIOLADO', async () => {
    const violado = makeTriagem({ statusSelo: 'VIOLADO', observacaoSelo: 'Lacre partido' });
    apiMocks.fetchTriagemDetalhe.mockResolvedValueOnce(makeDetalhe(violado));
    apiMocks.concluirTriagem.mockResolvedValueOnce({ ...violado, status: 'CONCLUIDA' });

    const onSaved = vi.fn();
    const onClose = vi.fn();

    render(
      <BancadaChecklistModal
        isOpen
        triagem={violado}
        onClose={onClose}
        onSaved={onSaved}
      />,
    );

    const concluirBtn = (await screen.findByRole('button', {
      name: /Concluir Laudo/i,
    })) as HTMLButtonElement;
    expect(concluirBtn.disabled).toBe(false);

    fireEvent.click(concluirBtn);
    await waitFor(() => {
      expect(apiMocks.concluirTriagem).toHaveBeenCalledWith(
        15,
        expect.objectContaining({ diagnosticoFinal: 'SEM_GARANTIA' }),
      );
    });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('exibe trilha completa no ProntuarioResumoModal, copia WhatsApp e restringe Reabrir OS a ADMIN', async () => {
    const concluida = makeTriagem({
      status: 'CONCLUIDA',
      diagnosticoFinal: 'OPERACIONAL',
      parecerTecnico: 'Sem falhas em 2h de bancada.',
      resumoCliente: 'Equipamento operando normalmente.',
      concluidoPorId: 12,
      concluidoPor: { id: 12, nome: 'Marcos Revisor', email: 'm@b.local', role: 'ADMIN' },
      concluidoEm: '2026-11-25T11:00:00.000Z',
    });

    apiMocks.fetchTriagemDetalhe.mockResolvedValue(makeDetalhe(concluida));
    apiMocks.reabrirTriagem.mockResolvedValue({ ...concluida, status: 'EM_ANALISE' });

    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    const { rerender } = render(
      <ProntuarioResumoModal isOpen triagem={concluida} onClose={vi.fn()} />,
    );

    expect(await screen.findByText('Carlos Balcão')).toBeTruthy();
    expect(screen.getByText('Ana Bancada')).toBeTruthy();
    expect(screen.getByText('Marcos Revisor')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Reabrir OS/i })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Copiar para WhatsApp/i }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('OS #15'));
    });

    // Como ADMIN, botão Reabrir OS aparece e executa reabrirTriagem após confirmação
    mockUserRef.current = {
      id: 12,
      nome: 'Marcos Revisor',
      email: 'm@b.local',
      role: 'ADMIN',
      ativo: true,
      criadoEm: '2026-11-25T09:00:00.000Z',
    };
    const onReopened = vi.fn();
    rerender(
      <ProntuarioResumoModal isOpen triagem={concluida} onClose={vi.fn()} onReopened={onReopened} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Reabrir OS/i }));
    fireEvent.click(screen.getByRole('button', { name: /Confirmar Reabertura/i }));

    await waitFor(() => {
      expect(apiMocks.reabrirTriagem).toHaveBeenCalledWith(15);
    });
    expect(onReopened).toHaveBeenCalledTimes(1);
  });
});
