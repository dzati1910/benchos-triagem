import React, { useState, useEffect } from 'react';
import { Triagem, Categoria, Cliente } from './types';
import { fetchTriagens, fetchCategorias, fetchClientes } from './services/api';
import { StatusBadge } from './components/StatusBadge';
import { NovaTriagemModal } from './components/NovaTriagemModal';
import { ChecklistModal } from './components/ChecklistModal';
import { DetalhesModal } from './components/DetalhesModal';
import {
  Search,
  Plus,
  Wrench,
  CheckCircle2,
  Clock,
  Layers,
  ShieldCheck,
  Eye,
  RefreshCw
} from 'lucide-react';

export const App: React.FC = () => {
  const [triagens, setTriagens] = useState<Triagem[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Modais
  const [modalNovaAberto, setModalNovaAberto] = useState(false);
  const [triagemChecklistId, setTriagemChecklistId] = useState<number | null>(null);
  const [triagemDetalhesId, setTriagemDetalhesId] = useState<number | null>(null);

  const carregarDados = async () => {
    setLoading(true);
    try {
      const [listaTriagens, listaCategorias, listaClientes] = await Promise.all([
        fetchTriagens(busca, filtroStatus),
        fetchCategorias(),
        fetchClientes(),
      ]);
      setTriagens(listaTriagens);
      setCategorias(listaCategorias);
      setClientes(listaClientes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [busca, filtroStatus]);

  // Contadores do topo
  const total = triagens.length;
  const pendentes = triagens.filter((t) => t.status === 'PENDENTE').length;
  const concluidos = triagens.filter((t) => t.status === 'CONCLUIDO').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Topo / Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg text-white leading-tight">BenchOS <span className="text-xs font-normal text-blue-400 px-2 py-0.5 bg-blue-500/10 rounded-full border border-blue-500/20">Distribuição</span></h1>
              <p className="text-xs text-slate-400">Sistema de Triagem Técnica & Bancada de Testes</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={carregarDados}
              title="Recarregar"
              className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setModalNovaAberto(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-semibold shadow-lg shadow-blue-950 transition-all"
            >
              <Plus className="w-4 h-4" /> Nova Entrada
            </button>
          </div>
        </div>
      </header>

      {/* Conteúdo Principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {/* Cards de Métricas */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">{total}</div>
              <div className="text-xs text-slate-400">Total de Triagens</div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-amber-400">{pendentes}</div>
              <div className="text-xs text-slate-400">Aguardando Bancada</div>
            </div>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center gap-4">
            <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-400">{concluidos}</div>
              <div className="text-xs text-slate-400">Laudos Concluídos</div>
            </div>
          </div>
        </div>

        {/* Barra de Filtros e Busca Rápida de Serial/MAC */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-slate-900/80 border border-slate-800 p-3 rounded-xl">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por Serial, MAC, Modelo ou Cliente..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 w-full sm:w-auto"
            >
              <option value="">Todos os Status</option>
              <option value="PENDENTE">Aguardando Bancada</option>
              <option value="CONCLUIDO">Concluídos</option>
            </select>
          </div>
        </div>

        {/* Tabela de Equipamentos */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">OS</th>
                  <th className="px-4 py-3">Equipamento</th>
                  <th className="px-4 py-3">Serial / MAC</th>
                  <th className="px-4 py-3">Cliente</th>
                  <th className="px-4 py-3">Defeito Reclamado</th>
                  <th className="px-4 py-3">Status / Parecer</th>
                  <th className="px-4 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {triagens.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      Nenhum equipamento registrado no momento.
                    </td>
                  </tr>
                ) : (
                  triagens.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-blue-400">
                        #{t.id}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-white">{t.fabricante} {t.modelo}</div>
                        <div className="text-[11px] text-slate-400">{t.categoria_nome}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-emerald-400 font-semibold tracking-wide">
                        {t.numero_serie_mac}
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-200">{t.cliente_nome}</div>
                        <div className="text-[11px] text-slate-400">{t.cliente_telefone || 'Sem fone'}</div>
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-slate-300" title={t.defeito_reclamado}>
                        {t.defeito_reclamado}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={t.status} diagnostico={t.diagnostico_final} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        {t.status === 'PENDENTE' ? (
                          <button
                            onClick={() => setTriagemChecklistId(t.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs shadow-md shadow-blue-950 transition-colors"
                          >
                            <Wrench className="w-3.5 h-3.5" /> Fazer Teste
                          </button>
                        ) : (
                          <button
                            onClick={() => setTriagemDetalhesId(t.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs border border-slate-700 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" /> Ver Laudo
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Modais */}
      {modalNovaAberto && (
        <NovaTriagemModal
          categorias={categorias}
          clientes={clientes}
          onClose={() => setModalNovaAberto(false)}
          onSuccess={() => {
            setModalNovaAberto(false);
            carregarDados();
          }}
          onClienteCadastrado={carregarDados}
        />
      )}

      {triagemChecklistId !== null && (
        <ChecklistModal
          triagemId={triagemChecklistId}
          onClose={() => setTriagemChecklistId(null)}
          onSuccess={() => {
            setTriagemChecklistId(null);
            carregarDados();
          }}
        />
      )}

      {triagemDetalhesId !== null && (
        <DetalhesModal
          triagemId={triagemDetalhesId}
          onClose={() => setTriagemDetalhesId(null)}
        />
      )}
    </div>
  );
};
export default App;
