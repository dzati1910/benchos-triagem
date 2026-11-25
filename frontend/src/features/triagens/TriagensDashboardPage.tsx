import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  Clock,
  Edit3,
  Eye,
  FileText,
  HardDrive,
  KeyRound,
  Layers,
  Play,
  Plus,
  RefreshCw,
  Search,
  Server,
  Wrench,
} from 'lucide-react';
import { fetchCategorias, fetchClientes, fetchTriagens } from '../../services/api';
import type { Categoria, Cliente, StatusTriagem, Triagem } from '../../types';
import { NovaOuEditarTriagemModal } from './components/NovaOuEditarTriagemModal';
import { SeloBadge } from './components/SeloBadge';
import { StatusBadge } from './components/StatusBadge';
import { formatarDataHora, isTriagemAberta } from './triagemHelpers';

type StatusFiltro = 'TODAS_ATIVAS' | StatusTriagem;

const CATEGORIA_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  HardDrive,
  Camera,
  Server,
  KeyRound,
  Wrench,
};

function renderCategoriaIcon(icone: string) {
  const Icon = CATEGORIA_ICONS[icone] ?? Wrench;
  return <Icon className="w-4 h-4 text-blue-400 shrink-0" />;
}

export const TriagensDashboardPage: React.FC = () => {
  const [triagens, setTriagens] = useState<Triagem[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);

  const [buscaInput, setBuscaInput] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('TODAS_ATIVAS');
  const [mostrarCanceladas, setMostrarCanceladas] = useState(false);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [avisoTemporario, setAvisoTemporario] = useState<string | null>(null);

  const [modalTriagemAberto, setModalTriagemAberto] = useState(false);
  const [triagemEdicao, setTriagemEdicao] = useState<Triagem | null>(null);

  // Estados preparados para Task 9 (BancadaChecklistModal e ProntuarioResumoModal).
  const [triagemBancadaSelecionada, setTriagemBancadaSelecionada] = useState<Triagem | null>(null);
  const [triagemResumoSelecionada, setTriagemResumoSelecionada] = useState<Triagem | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBuscaAplicada(buscaInput.trim());
    }, 300);
    return () => window.clearTimeout(timer);
  }, [buscaInput]);

  const carregarTriagens = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const lista = await fetchTriagens({
        busca: buscaAplicada || undefined,
        incluirCanceladas: mostrarCanceladas || statusFiltro === 'CANCELADA',
      });
      setTriagens(lista);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar triagens.');
    } finally {
      setCarregando(false);
    }
  }, [buscaAplicada, mostrarCanceladas, statusFiltro]);

  const carregarCatalogos = useCallback(async () => {
    try {
      const [cats, clis] = await Promise.all([fetchCategorias(), fetchClientes()]);
      setCategorias(cats);
      setClientes(clis);
    } catch (err) {
      setErro((prev) =>
        prev ?? (err instanceof Error ? err.message : 'Erro ao carregar categorias e clientes.'),
      );
    }
  }, []);

  useEffect(() => {
    void carregarCatalogos();
  }, [carregarCatalogos]);

  useEffect(() => {
    void carregarTriagens();
  }, [carregarTriagens]);

  const metricas = useMemo(() => {
    let pendentes = 0;
    let emAnalise = 0;
    let concluidas = 0;
    let canceladas = 0;

    for (const item of triagens) {
      if (item.status === 'PENDENTE') pendentes += 1;
      else if (item.status === 'EM_ANALISE') emAnalise += 1;
      else if (item.status === 'CONCLUIDA') concluidas += 1;
      else if (item.status === 'CANCELADA') canceladas += 1;
    }

    return {
      totalAtivas: pendentes + emAnalise,
      pendentes,
      emAnalise,
      concluidas,
      canceladas,
    };
  }, [triagens]);

  const triagensVisiveis = useMemo(() => {
    if (statusFiltro === 'TODAS_ATIVAS') {
      return mostrarCanceladas
        ? triagens
        : triagens.filter((item) => item.status !== 'CANCELADA');
    }
    return triagens.filter((item) => item.status === statusFiltro);
  }, [triagens, statusFiltro, mostrarCanceladas]);

  const handleAbrirNovaTriagem = () => {
    setTriagemEdicao(null);
    setModalTriagemAberto(true);
  };

  const handleAbrirEdicao = (triagem: Triagem) => {
    setTriagemEdicao(triagem);
    setModalTriagemAberto(true);
  };

  const handleTriagemSalva = () => {
    setModalTriagemAberto(false);
    setTriagemEdicao(null);
    void carregarTriagens();
  };

  const handleTriagemCancelada = () => {
    setModalTriagemAberto(false);
    setTriagemEdicao(null);
    void carregarTriagens();
  };

  const handleClienteCriado = (novoCliente: Cliente) => {
    setClientes((prev) =>
      [...prev, novoCliente].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    );
  };

  const handleToggleCanceladas = () => {
    setMostrarCanceladas((prev) => {
      const next = !prev;
      if (!next && statusFiltro === 'CANCELADA') {
        setStatusFiltro('TODAS_ATIVAS');
      }
      return next;
    });
  };

  const handleIniciarOuContinuarTeste = (triagem: Triagem) => {
    setTriagemBancadaSelecionada(triagem);
    setAvisoTemporario(
      `OS #${triagem.id} (${triagem.modelo}) selecionada para bancada. O modal de checklist interativo será habilitado na próxima etapa.`,
    );
  };

  const handleVerResumo = (triagem: Triagem) => {
    setTriagemResumoSelecionada(triagem);
    setAvisoTemporario(
      `Resumo da OS #${triagem.id} (${triagem.modelo}) selecionado. A visualização completa do laudo será habilitada na próxima etapa.`,
    );
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white">Triagens na Bancada</h2>
          <p className="text-sm text-slate-400">
            Recebimento com inspeção de selo, histórico de reincidência e acompanhamento de testes.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void carregarTriagens()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <button
            type="button"
            onClick={handleAbrirNovaTriagem}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold shadow-lg shadow-blue-950 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Triagem
          </button>
        </div>
      </div>

      {/* Cards de Métrica */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Total Ativas</p>
            <p className="text-2xl font-bold text-white mt-1">{metricas.totalAtivas}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Pendentes + Em análise</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Aguardando Bancada</p>
            <p className="text-2xl font-bold text-amber-300 mt-1">{metricas.pendentes}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Recebidas na fila</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Em Análise</p>
            <p className="text-2xl font-bold text-blue-300 mt-1">{metricas.emAnalise}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Testes em andamento</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Wrench className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Laudos Concluídos</p>
            <p className="text-2xl font-bold text-emerald-300 mt-1">{metricas.concluidas}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Prontos para entrega</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filtros e Busca */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-xl">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="search"
              value={buscaInput}
              onChange={(e) => setBuscaInput(e.target.value)}
              placeholder="Buscar por Serial/MAC, Modelo, Cliente ou #OS..."
              aria-label="Buscar triagens por Serial/MAC, Modelo, Cliente ou #OS"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                { id: 'TODAS_ATIVAS', label: 'Todas ativas' },
                { id: 'PENDENTE', label: 'Pendentes' },
                { id: 'EM_ANALISE', label: 'Em Análise' },
                { id: 'CONCLUIDA', label: 'Concluídas' },
              ] as Array<{ id: StatusFiltro; label: string }>
            ).map((tab) => {
              const ativo = statusFiltro === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusFiltro(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    ativo
                      ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
                      : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}

            <button
              type="button"
              onClick={handleToggleCanceladas}
              aria-pressed={mostrarCanceladas}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                mostrarCanceladas
                  ? 'bg-slate-700/60 text-white border-slate-500'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {mostrarCanceladas ? 'Ocultar Canceladas' : 'Mostrar Canceladas'}
            </button>

            {mostrarCanceladas && (
              <button
                type="button"
                onClick={() => setStatusFiltro('CANCELADA')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  statusFiltro === 'CANCELADA'
                    ? 'bg-slate-700 text-white border-slate-500'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                Somente Canceladas ({metricas.canceladas})
              </button>
            )}
          </div>
        </div>
      </div>

      {erro && (
        <div
          role="alert"
          className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl px-4 py-3"
        >
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
          <span>{erro}</span>
        </div>
      )}

      {avisoTemporario && (triagemBancadaSelecionada || triagemResumoSelecionada) && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 bg-blue-500/10 border border-blue-500/30 text-blue-200 text-xs rounded-xl px-4 py-3"
        >
          <span>{avisoTemporario}</span>
          <button
            type="button"
            onClick={() => {
              setAvisoTemporario(null);
              setTriagemBancadaSelecionada(null);
              setTriagemResumoSelecionada(null);
            }}
            className="text-blue-300 hover:text-white font-medium shrink-0"
          >
            Fechar aviso
          </button>
        </div>
      )}

      {/* Tabela de Triagens */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-[11px] uppercase tracking-wider text-slate-400">
                <th className="py-3 px-4 font-semibold">OS</th>
                <th className="py-3 px-4 font-semibold">Equipamento</th>
                <th className="py-3 px-4 font-semibold">Serial / MAC</th>
                <th className="py-3 px-4 font-semibold">Selo</th>
                <th className="py-3 px-4 font-semibold">Cliente</th>
                <th className="py-3 px-4 font-semibold">Trilha de Auditoria</th>
                <th className="py-3 px-4 font-semibold">Status / Diagnóstico</th>
                <th className="py-3 px-4 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-sm">
              {carregando ? (
                <tr>
                  <td colSpan={8} className="py-10 px-4 text-center text-sm text-slate-400">
                    Carregando triagens...
                  </td>
                </tr>
              ) : triagensVisiveis.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 px-4 text-center text-sm text-slate-400">
                    Nenhuma triagem encontrada para os filtros atuais.
                  </td>
                </tr>
              ) : (
                triagensVisiveis.map((triagem) => {
                  const aberta = isTriagemAberta(triagem.status);
                  return (
                    <tr
                      key={triagem.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        triagem.status === 'CANCELADA' ? 'opacity-70' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <div className="font-mono font-semibold text-white">#{triagem.id}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {formatarDataHora(triagem.criadoEm)}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5">{renderCategoriaIcon(triagem.categoria.icone)}</div>
                          <div>
                            <div className="font-medium text-white">
                              {triagem.fabricante} {triagem.modelo}
                            </div>
                            <div className="text-xs text-slate-400">{triagem.categoria.nome}</div>
                            <div
                              className="text-[11px] text-slate-500 mt-0.5 max-w-xs truncate"
                              title={triagem.defeitoReclamado}
                            >
                              Defeito: {triagem.defeitoReclamado}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <span className="font-mono text-xs bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200">
                          {triagem.numeroSerieMac}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <SeloBadge
                          statusSelo={triagem.statusSelo}
                          observacaoSelo={triagem.observacaoSelo}
                          showObservacao
                        />
                      </td>

                      <td className="py-3.5 px-4 align-top">
                        <div className="font-medium text-slate-200">{triagem.cliente.nome}</div>
                        {triagem.cliente.telefone && (
                          <div className="text-xs text-slate-400">{triagem.cliente.telefone}</div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top text-xs text-slate-300 space-y-0.5 whitespace-nowrap">
                        <div>
                          <span className="text-slate-500">Recebido por:</span>{' '}
                          <span>{triagem.recebidoPor.nome}</span>
                        </div>
                        {triagem.analiseIniciadaPor && (
                          <div>
                            <span className="text-slate-500">Iniciado por:</span>{' '}
                            <span>{triagem.analiseIniciadaPor.nome}</span>
                          </div>
                        )}
                        {triagem.concluidoPor && (
                          <div>
                            <span className="text-slate-500">Concluído por:</span>{' '}
                            <span className="text-emerald-300">{triagem.concluidoPor.nome}</span>
                          </div>
                        )}
                        {triagem.canceladoPor && (
                          <div>
                            <span className="text-slate-500">Cancelado por:</span>{' '}
                            <span className="text-red-300">{triagem.canceladoPor.nome}</span>
                          </div>
                        )}
                      </td>

                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <StatusBadge
                          status={triagem.status}
                          diagnosticoFinal={triagem.diagnosticoFinal}
                        />
                      </td>

                      <td className="py-3.5 px-4 align-top text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {triagem.status === 'PENDENTE' && (
                            <button
                              type="button"
                              onClick={() => handleIniciarOuContinuarTeste(triagem)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors"
                            >
                              <Play className="w-3.5 h-3.5" />
                              Iniciar Teste
                            </button>
                          )}

                          {triagem.status === 'EM_ANALISE' && (
                            <button
                              type="button"
                              onClick={() => handleIniciarOuContinuarTeste(triagem)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-200 text-xs font-medium transition-colors"
                            >
                              <Wrench className="w-3.5 h-3.5" />
                              Continuar Teste
                            </button>
                          )}

                          {aberta && (
                            <button
                              type="button"
                              onClick={() => handleAbrirEdicao(triagem)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-medium transition-colors"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Editar
                            </button>
                          )}

                          {triagem.status === 'CONCLUIDA' && (
                            <button
                              type="button"
                              onClick={() => handleVerResumo(triagem)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 text-xs font-medium transition-colors"
                            >
                              <FileText className="w-3.5 h-3.5" />
                              Ver Laudo
                            </button>
                          )}

                          {triagem.status === 'CANCELADA' && (
                            <button
                              type="button"
                              onClick={() => handleVerResumo(triagem)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-medium transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Ver Resumo
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <NovaOuEditarTriagemModal
        isOpen={modalTriagemAberto}
        triagemEdicao={triagemEdicao}
        categorias={categorias}
        clientes={clientes}
        onClose={() => {
          setModalTriagemAberto(false);
          setTriagemEdicao(null);
        }}
        onSaved={handleTriagemSalva}
        onCanceled={handleTriagemCancelada}
        onClienteCreated={handleClienteCriado}
      />
    </div>
  );
};
