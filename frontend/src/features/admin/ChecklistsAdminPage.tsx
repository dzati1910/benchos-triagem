import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Camera,
  CheckCircle2,
  ClipboardList,
  Edit3,
  HardDrive,
  KeyRound,
  Plus,
  Power,
  RefreshCw,
  Server,
  Wrench,
  X,
} from 'lucide-react';
import {
  atualizarCategoria,
  atualizarItemChecklist,
  criarCategoria,
  criarItemChecklist,
  fetchCategoriasAdmin,
} from '../../services/api';
import type { Categoria, ItemChecklist } from '../../types';

const ICON_OPTIONS: Array<{
  value: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: 'HardDrive', label: 'Disco / HD', Icon: HardDrive },
  { value: 'Camera', label: 'Câmera CFTV / IP', Icon: Camera },
  { value: 'Server', label: 'DVR / NVR / Switch', Icon: Server },
  { value: 'KeyRound', label: 'Controle de Acesso', Icon: KeyRound },
  { value: 'Wrench', label: 'Equipamento Geral', Icon: Wrench },
];

function renderCategoriaIcon(icone: string, className = 'w-4 h-4 text-blue-400 shrink-0') {
  const match = ICON_OPTIONS.find((opt) => opt.value === icone);
  const Icon = match ? match.Icon : Wrench;
  return <Icon className={className} />;
}

export const ChecklistsAdminPage: React.FC = () => {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaSelecionadaId, setCategoriaSelecionadaId] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Formulário de nova categoria
  const [novaCatAberta, setNovaCatAberta] = useState(false);
  const [novaCatNome, setNovaCatNome] = useState('');
  const [novaCatIcone, setNovaCatIcone] = useState('Wrench');
  const [novaCatInstrucao, setNovaCatInstrucao] = useState('');
  const [salvandoCat, setSalvandoCat] = useState(false);

  // Formulário de edição da categoria selecionada
  const [editandoCat, setEditandoCat] = useState(false);
  const [editCatNome, setEditCatNome] = useState('');
  const [editCatIcone, setEditCatIcone] = useState('Wrench');
  const [editCatInstrucao, setEditCatInstrucao] = useState('');

  // Formulário de novo item
  const [novoItemAberto, setNovoItemAberto] = useState(false);
  const [novoItemDescricao, setNovoItemDescricao] = useState('');
  const [novoItemComoTestar, setNovoItemComoTestar] = useState('');
  const [novoItemOrdem, setNovoItemOrdem] = useState('');
  const [salvandoItem, setSalvandoItem] = useState(false);

  // Edição inline de item
  const [itemEditandoId, setItemEditandoId] = useState<number | null>(null);
  const [editItemDescricao, setEditItemDescricao] = useState('');
  const [editItemComoTestar, setEditItemComoTestar] = useState('');
  const [editItemOrdem, setEditItemOrdem] = useState('1');

  const carregarCategorias = useCallback(async (preferredId?: number) => {
    setCarregando(true);
    setErro(null);
    try {
      const lista = await fetchCategoriasAdmin();
      setCategorias(lista);
      setCategoriaSelecionadaId((prev) => {
        const target = preferredId ?? prev;
        if (target && lista.some((c) => c.id === target)) {
          return target;
        }
        return lista[0]?.id ?? null;
      });
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar categorias e checklists.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregarCategorias();
  }, [carregarCategorias]);

  const categoriaSelecionada = useMemo(
    () => categorias.find((c) => c.id === categoriaSelecionadaId) ?? null,
    [categorias, categoriaSelecionadaId],
  );

  const itensOrdenados = useMemo(() => {
    const itens = categoriaSelecionada?.itens ?? [];
    return [...itens].sort((a, b) => a.ordem - b.ordem || a.id - b.id);
  }, [categoriaSelecionada]);

  const iniciarEdicaoCategoria = (cat: Categoria) => {
    setEditCatNome(cat.nome);
    setEditCatIcone(cat.icone);
    setEditCatInstrucao(cat.instrucaoGeral ?? '');
    setEditandoCat(true);
  };

  const handleCriarCategoria = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErro(null);
    setFeedback(null);
    setSalvandoCat(true);

    try {
      const criada = await criarCategoria({
        nome: novaCatNome.trim(),
        icone: novaCatIcone,
        instrucaoGeral: novaCatInstrucao.trim() || null,
      });
      setNovaCatNome('');
      setNovaCatIcone('Wrench');
      setNovaCatInstrucao('');
      setNovaCatAberta(false);
      await carregarCategorias(criada.id);
      setFeedback(`Categoria "${criada.nome}" criada com sucesso.`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível criar a categoria.');
    } finally {
      setSalvandoCat(false);
    }
  };

  const handleSalvarCategoria = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!categoriaSelecionada) return;
    setErro(null);
    setFeedback(null);
    setSalvandoCat(true);

    try {
      const atualizada = await atualizarCategoria(categoriaSelecionada.id, {
        nome: editCatNome.trim(),
        icone: editCatIcone,
        instrucaoGeral: editCatInstrucao.trim() || null,
      });
      setEditandoCat(false);
      await carregarCategorias(atualizada.id);
      setFeedback(`Categoria "${atualizada.nome}" atualizada.`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível atualizar a categoria.');
    } finally {
      setSalvandoCat(false);
    }
  };

  const handleToggleCategoriaAtiva = async (cat: Categoria) => {
    setErro(null);
    setFeedback(null);
    try {
      const atualizada = await atualizarCategoria(cat.id, { ativo: !cat.ativo });
      await carregarCategorias(atualizada.id);
      setFeedback(
        atualizada.ativo
          ? `Categoria "${atualizada.nome}" reativada.`
          : `Categoria "${atualizada.nome}" desativada.`,
      );
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível alterar o status da categoria.');
    }
  };

  const handleCriarItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!categoriaSelecionada) return;
    setErro(null);
    setFeedback(null);
    setSalvandoItem(true);

    try {
      const ordemNum = novoItemOrdem.trim() ? Number(novoItemOrdem.trim()) : undefined;
      const criado = await criarItemChecklist(categoriaSelecionada.id, {
        descricao: novoItemDescricao.trim(),
        comoTestar: novoItemComoTestar.trim(),
        ...(ordemNum && Number.isInteger(ordemNum) && ordemNum > 0 ? { ordem: ordemNum } : {}),
      });
      setNovoItemDescricao('');
      setNovoItemComoTestar('');
      setNovoItemOrdem('');
      setNovoItemAberto(false);
      await carregarCategorias(categoriaSelecionada.id);
      setFeedback(`Item "${criado.descricao}" adicionado ao checklist.`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível criar o item.');
    } finally {
      setSalvandoItem(false);
    }
  };

  const iniciarEdicaoItem = (item: ItemChecklist) => {
    setItemEditandoId(item.id);
    setEditItemDescricao(item.descricao);
    setEditItemComoTestar(item.comoTestar);
    setEditItemOrdem(String(item.ordem));
  };

  const handleSalvarItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!itemEditandoId || !categoriaSelecionada) return;
    setErro(null);
    setFeedback(null);
    setSalvandoItem(true);

    try {
      const ordemNum = Number(editItemOrdem);
      const atualizado = await atualizarItemChecklist(itemEditandoId, {
        descricao: editItemDescricao.trim(),
        comoTestar: editItemComoTestar.trim(),
        ...(Number.isInteger(ordemNum) && ordemNum > 0 ? { ordem: ordemNum } : {}),
      });
      setItemEditandoId(null);
      await carregarCategorias(categoriaSelecionada.id);
      setFeedback(`Item "${atualizado.descricao}" atualizado.`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível atualizar o item.');
    } finally {
      setSalvandoItem(false);
    }
  };

  const handleToggleItemAtivo = async (item: ItemChecklist) => {
    if (!categoriaSelecionada) return;
    setErro(null);
    setFeedback(null);
    try {
      const atualizado = await atualizarItemChecklist(item.id, { ativo: !item.ativo });
      await carregarCategorias(categoriaSelecionada.id);
      setFeedback(
        atualizado.ativo
          ? `Item "${atualizado.descricao}" reativado.`
          : `Item "${atualizado.descricao}" desativado.`,
      );
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível alterar o status do item.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-blue-400" />
            Gestão de Categorias &amp; Checklists
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Configure roteiros de bancada e instruções práticas de como testar cada item.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void carregarCategorias()}
            disabled={carregando}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 hover:bg-slate-800 text-slate-200 text-xs font-medium transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <button
            type="button"
            onClick={() => {
              setErro(null);
              setFeedback(null);
              setNovaCatAberta((prev) => !prev);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-950 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nova Categoria
          </button>
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

      {feedback && (
        <div
          role="status"
          className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs rounded-xl px-4 py-3"
        >
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
          <span>{feedback}</span>
        </div>
      )}

      {novaCatAberta && (
        <form
          onSubmit={handleCriarCategoria}
          className="bg-slate-900/80 border border-blue-500/30 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Cadastrar Nova Categoria</h3>
            <button
              type="button"
              onClick={() => setNovaCatAberta(false)}
              aria-label="Fechar criação de categoria"
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor="nova-cat-nome" className="block text-xs font-medium text-slate-300">
                Nome da categoria
              </label>
              <input
                id="nova-cat-nome"
                type="text"
                required
                value={novaCatNome}
                onChange={(e) => setNovaCatNome(e.target.value)}
                placeholder="Ex.: Switch PoE Gerenciável"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="nova-cat-icone" className="block text-xs font-medium text-slate-300">
                Ícone
              </label>
              <select
                id="nova-cat-icone"
                value={novaCatIcone}
                onChange={(e) => setNovaCatIcone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {ICON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} ({opt.value})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="nova-cat-instrucao" className="block text-xs font-medium text-slate-300">
              Instrução geral da bancada (opcional)
            </label>
            <textarea
              id="nova-cat-instrucao"
              rows={2}
              value={novaCatInstrucao}
              onChange={(e) => setNovaCatInstrucao(e.target.value)}
              placeholder="Orientação exibida no topo do checklist para todos os técnicos..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setNovaCatAberta(false)}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={salvandoCat}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-semibold"
            >
              {salvandoCat ? 'Salvando...' : 'Salvar Categoria'}
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-5 bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Categorias ({categorias.length})
          </h3>

          {carregando && categorias.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-400">Carregando categorias...</div>
          ) : categorias.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-400">
              Nenhuma categoria cadastrada.
            </div>
          ) : (
            <div className="space-y-2">
              {categorias.map((cat) => {
                const selecionada = cat.id === categoriaSelecionada?.id;
                const totalItens = cat.itens?.length ?? 0;

                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      setCategoriaSelecionadaId(cat.id);
                      setEditandoCat(false);
                      setItemEditandoId(null);
                      setNovoItemAberto(false);
                    }}
                    className={`w-full text-left p-3.5 rounded-xl border transition-colors flex items-start justify-between gap-3 ${
                      selecionada
                        ? 'bg-blue-600/15 border-blue-500/40 text-white'
                        : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 text-slate-200'
                    } ${!cat.ativo ? 'opacity-65' : ''}`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="mt-0.5">{renderCategoriaIcon(cat.icone)}</div>
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{cat.nome}</div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {totalItens} {totalItens === 1 ? 'item' : 'itens'} no roteiro
                        </div>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                        cat.ativo
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : 'bg-red-500/10 text-red-300 border-red-500/30'
                      }`}
                    >
                      {cat.ativo ? 'Ativa' : 'Inativa'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        <section className="lg:col-span-7 bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-5">
          {!categoriaSelecionada ? (
            <div className="py-10 text-center text-sm text-slate-400">
              Selecione uma categoria para visualizar e editar os itens do checklist.
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-slate-800 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {renderCategoriaIcon(categoriaSelecionada.icone, 'w-5 h-5 text-blue-400')}
                    <h3 className="text-lg font-semibold text-white">
                      {categoriaSelecionada.nome}
                    </h3>
                    <span
                      className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                        categoriaSelecionada.ativo
                          ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                          : 'bg-red-500/10 text-red-300 border-red-500/30'
                      }`}
                    >
                      {categoriaSelecionada.ativo ? 'Ativa' : 'Inativa'}
                    </span>
                  </div>

                  {categoriaSelecionada.instrucaoGeral && (
                    <p className="text-xs text-slate-300 bg-slate-950/70 border border-slate-800 rounded-lg px-3 py-2 mt-2">
                      <span className="font-semibold text-blue-300">Instrução geral: </span>
                      {categoriaSelecionada.instrucaoGeral}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => iniciarEdicaoCategoria(categoriaSelecionada)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    Editar Categoria
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleToggleCategoriaAtiva(categoriaSelecionada)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium ${
                      categoriaSelecionada.ativo
                        ? 'bg-red-500/10 hover:bg-red-500/20 text-red-300 border-red-500/30'
                        : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    <Power className="w-3.5 h-3.5" />
                    {categoriaSelecionada.ativo ? 'Desativar' : 'Ativar'}
                  </button>
                </div>
              </div>

              {editandoCat && (
                <form
                  onSubmit={handleSalvarCategoria}
                  className="bg-slate-950/80 border border-slate-700 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                      Editar Categoria
                    </h4>
                    <button
                      type="button"
                      onClick={() => setEditandoCat(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label htmlFor="edit-cat-nome" className="block text-xs text-slate-300">
                        Nome
                      </label>
                      <input
                        id="edit-cat-nome"
                        type="text"
                        required
                        value={editCatNome}
                        onChange={(e) => setEditCatNome(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor="edit-cat-icone" className="block text-xs text-slate-300">
                        Ícone
                      </label>
                      <select
                        id="edit-cat-icone"
                        value={editCatIcone}
                        onChange={(e) => setEditCatIcone(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                      >
                        {ICON_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label} ({opt.value})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="edit-cat-instrucao" className="block text-xs text-slate-300">
                      Instrução geral
                    </label>
                    <textarea
                      id="edit-cat-instrucao"
                      rows={2}
                      value={editCatInstrucao}
                      onChange={(e) => setEditCatInstrucao(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditandoCat(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={salvandoCat}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                    >
                      Salvar Alterações
                    </button>
                  </div>
                </form>
              )}

              <div className="flex items-center justify-between">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Itens de Teste ({itensOrdenados.length})
                </h4>
                <button
                  type="button"
                  onClick={() => setNovoItemAberto((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Novo Item
                </button>
              </div>

              {novoItemAberto && (
                <form
                  onSubmit={handleCriarItem}
                  className="bg-slate-950/80 border border-blue-500/30 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-semibold text-white">Adicionar Item ao Checklist</h5>
                    <button
                      type="button"
                      onClick={() => setNovoItemAberto(false)}
                      className="text-slate-400 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-3 space-y-1">
                      <label htmlFor="novo-item-descricao" className="block text-xs text-slate-300">
                        Descrição do ponto de verificação
                      </label>
                      <input
                        id="novo-item-descricao"
                        type="text"
                        required
                        value={novoItemDescricao}
                        onChange={(e) => setNovoItemDescricao(e.target.value)}
                        placeholder="Ex.: Teste de portas PoE sob carga"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="novo-item-ordem" className="block text-xs text-slate-300">
                        Ordem (opcional)
                      </label>
                      <input
                        id="novo-item-ordem"
                        type="number"
                        min={1}
                        value={novoItemOrdem}
                        onChange={(e) => setNovoItemOrdem(e.target.value)}
                        placeholder="Auto"
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label htmlFor="novo-item-como-testar" className="block text-xs text-slate-300">
                      Como testar na bancada
                    </label>
                    <textarea
                      id="novo-item-como-testar"
                      required
                      rows={2}
                      value={novoItemComoTestar}
                      onChange={(e) => setNovoItemComoTestar(e.target.value)}
                      placeholder="Descreva passo a passo o procedimento técnico na bancada..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setNovoItemAberto(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={salvandoItem}
                      className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-semibold"
                    >
                      {salvandoItem ? 'Salvando...' : 'Adicionar Item'}
                    </button>
                  </div>
                </form>
              )}

              {itensOrdenados.length === 0 ? (
                <div className="py-8 text-center text-sm text-slate-400 border border-dashed border-slate-800 rounded-xl">
                  Nenhum item cadastrado nesta categoria.
                </div>
              ) : (
                <div className="space-y-3">
                  {itensOrdenados.map((item) => {
                    const editandoEste = itemEditandoId === item.id;

                    if (editandoEste) {
                      return (
                        <form
                          key={item.id}
                          onSubmit={handleSalvarItem}
                          className="bg-slate-950/90 border border-blue-500/40 rounded-xl p-4 space-y-3"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                            <div className="sm:col-span-3 space-y-1">
                              <label
                                htmlFor={`edit-item-desc-${item.id}`}
                                className="block text-xs text-slate-300"
                              >
                                Descrição
                              </label>
                              <input
                                id={`edit-item-desc-${item.id}`}
                                type="text"
                                required
                                value={editItemDescricao}
                                onChange={(e) => setEditItemDescricao(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                              />
                            </div>
                            <div className="space-y-1">
                              <label
                                htmlFor={`edit-item-ordem-${item.id}`}
                                className="block text-xs text-slate-300"
                              >
                                Ordem
                              </label>
                              <input
                                id={`edit-item-ordem-${item.id}`}
                                type="number"
                                min={1}
                                required
                                value={editItemOrdem}
                                onChange={(e) => setEditItemOrdem(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label
                              htmlFor={`edit-item-como-${item.id}`}
                              className="block text-xs text-slate-300"
                            >
                              Como testar na bancada
                            </label>
                            <textarea
                              id={`edit-item-como-${item.id}`}
                              required
                              rows={2}
                              value={editItemComoTestar}
                              onChange={(e) => setEditItemComoTestar(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-blue-500"
                            />
                          </div>

                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setItemEditandoId(null)}
                              className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs"
                            >
                              Cancelar
                            </button>
                            <button
                              type="submit"
                              disabled={salvandoItem}
                              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
                            >
                              Salvar Item
                            </button>
                          </div>
                        </form>
                      );
                    }

                    return (
                      <div
                        key={item.id}
                        className={`bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2 ${
                          !item.ativo ? 'opacity-65' : ''
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-slate-800 text-slate-200 text-xs font-bold shrink-0">
                              #{item.ordem}
                            </span>
                            <div>
                              <div className="font-medium text-sm text-white">{item.descricao}</div>
                              <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                <span className="text-blue-300 font-medium">Como testar: </span>
                                {item.comoTestar}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                                item.ativo
                                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                  : 'bg-red-500/10 text-red-300 border-red-500/30'
                              }`}
                            >
                              {item.ativo ? 'Ativo' : 'Inativo'}
                            </span>

                            <button
                              type="button"
                              onClick={() => iniciarEdicaoItem(item)}
                              aria-label={`Editar item ${item.descricao}`}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium"
                            >
                              Editar
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleToggleItemAtivo(item)}
                              className={`px-2.5 py-1 rounded-lg border text-xs font-medium ${
                                item.ativo
                                  ? 'bg-red-500/10 hover:bg-red-500/20 text-red-300 border-red-500/30'
                                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              }`}
                            >
                              {item.ativo ? 'Desativar' : 'Ativar'}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
};
