import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Plus,
  RefreshCw,
  Shield,
  UserCheck,
  UserPlus,
  UserX,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  atualizarUsuario,
  criarUsuario,
  fetchUsers,
  redefinirSenhaUsuario,
} from '../../services/api';
import type { PublicUser, Role } from '../../types';

function formatarData(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('pt-BR');
}

export const UsuariosAdminPage: React.FC = () => {
  const { user: currentUser } = useAuth();

  const [usuarios, setUsuarios] = useState<PublicUser[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [processandoId, setProcessandoId] = useState<number | null>(null);

  const [formAberto, setFormAberto] = useState(false);
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [role, setRole] = useState<Role>('FUNCIONARIO');
  const [criando, setCriando] = useState(false);

  const [usuarioSenhaAlvo, setUsuarioSenhaAlvo] = useState<PublicUser | null>(null);
  const [novaSenha, setNovaSenha] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  const carregarUsuarios = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const lista = await fetchUsers();
      setUsuarios(lista);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao carregar funcionários.');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    void carregarUsuarios();
  }, [carregarUsuarios]);

  const resumo = useMemo(() => {
    const total = usuarios.length;
    const ativos = usuarios.filter((u) => u.ativo).length;
    const admins = usuarios.filter((u) => u.role === 'ADMIN' && u.ativo).length;
    return { total, ativos, admins };
  }, [usuarios]);

  const handleCriarUsuario = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErro(null);
    setFeedback(null);
    setCriando(true);

    try {
      const criado = await criarUsuario({
        nome: nome.trim(),
        email: email.trim().toLowerCase(),
        senha,
        role,
      });
      setUsuarios((prev) => [...prev, criado]);
      setNome('');
      setEmail('');
      setSenha('');
      setRole('FUNCIONARIO');
      setFormAberto(false);
      setFeedback(`Funcionário "${criado.nome}" cadastrado com sucesso.`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível criar o funcionário.');
    } finally {
      setCriando(false);
    }
  };

  const handleToggleAtivo = async (alvo: PublicUser) => {
    if (alvo.id === currentUser?.id) return;
    setErro(null);
    setFeedback(null);
    setProcessandoId(alvo.id);

    try {
      const atualizado = await atualizarUsuario(alvo.id, { ativo: !alvo.ativo });
      setUsuarios((prev) => prev.map((u) => (u.id === atualizado.id ? atualizado : u)));
      setFeedback(
        atualizado.ativo
          ? `Conta de "${atualizado.nome}" reativada.`
          : `Conta de "${atualizado.nome}" desativada.`,
      );
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível atualizar o status.');
    } finally {
      setProcessandoId(null);
    }
  };

  const handleAlterarRole = async (alvo: PublicUser, novoRole: Role) => {
    if (alvo.id === currentUser?.id || alvo.role === novoRole) return;
    setErro(null);
    setFeedback(null);
    setProcessandoId(alvo.id);

    try {
      const atualizado = await atualizarUsuario(alvo.id, { role: novoRole });
      setUsuarios((prev) => prev.map((u) => (u.id === atualizado.id ? atualizado : u)));
      setFeedback(`Papel de "${atualizado.nome}" atualizado para ${atualizado.role}.`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível alterar o papel.');
    } finally {
      setProcessandoId(null);
    }
  };

  const handleRedefinirSenha = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!usuarioSenhaAlvo) return;
    setErro(null);
    setFeedback(null);
    setSalvandoSenha(true);

    try {
      const res = await redefinirSenhaUsuario(usuarioSenhaAlvo.id, novaSenha);
      setFeedback(`${res.message} (${usuarioSenhaAlvo.nome})`);
      setUsuarioSenhaAlvo(null);
      setNovaSenha('');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível redefinir a senha.');
    } finally {
      setSalvandoSenha(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            Gestão de Equipe
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Cadastre técnicos e atendentes, controle acessos e redefina senhas da filial.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void carregarUsuarios()}
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
              setFormAberto((prev) => !prev);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-950 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Novo Funcionário
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Total cadastrado</div>
          <div className="text-2xl font-bold text-white mt-1">{resumo.total}</div>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Contas ativas</div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">{resumo.ativos}</div>
        </div>
        <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400">Administradores ativos</div>
          <div className="text-2xl font-bold text-amber-300 mt-1">{resumo.admins}</div>
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

      {formAberto && (
        <form
          onSubmit={handleCriarUsuario}
          className="bg-slate-900/80 border border-blue-500/30 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-blue-400" />
              Cadastrar novo funcionário
            </h3>
            <button
              type="button"
              onClick={() => setFormAberto(false)}
              aria-label="Fechar cadastro de funcionário"
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1">
              <label htmlFor="novo-usuario-nome" className="block text-xs font-medium text-slate-300">
                Nome completo
              </label>
              <input
                id="novo-usuario-nome"
                type="text"
                required
                minLength={2}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: João Técnico"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="novo-usuario-email" className="block text-xs font-medium text-slate-300">
                E-mail corporativo
              </label>
              <input
                id="novo-usuario-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="joao@benchos.local"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="novo-usuario-senha" className="block text-xs font-medium text-slate-300">
                Senha inicial (mín. 6)
              </label>
              <input
                id="novo-usuario-senha"
                type="password"
                required
                minLength={6}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="novo-usuario-role" className="block text-xs font-medium text-slate-300">
                Papel de acesso
              </label>
              <select
                id="novo-usuario-role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="FUNCIONARIO">Funcionário (Balcão / Bancada)</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setFormAberto(false)}
              className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={criando}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-semibold"
            >
              {criando ? 'Salvando...' : 'Salvar Funcionário'}
            </button>
          </div>
        </form>
      )}

      {usuarioSenhaAlvo && (
        <form
          onSubmit={handleRedefinirSenha}
          className="bg-slate-900/90 border border-amber-500/30 rounded-xl p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400" />
              Redefinir senha de {usuarioSenhaAlvo.nome}
            </h3>
            <button
              type="button"
              onClick={() => {
                setUsuarioSenhaAlvo(null);
                setNovaSenha('');
              }}
              aria-label="Cancelar redefinição de senha"
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
            <div className="flex-1 space-y-1">
              <label htmlFor="nova-senha-input" className="block text-xs font-medium text-slate-300">
                Nova senha (mínimo 6 caracteres)
              </label>
              <input
                id="nova-senha-input"
                type="password"
                required
                minLength={6}
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Digite a nova senha"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setUsuarioSenhaAlvo(null);
                  setNovaSenha('');
                }}
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={salvandoSenha}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white text-xs font-semibold"
              >
                {salvandoSenha ? 'Atualizando...' : 'Confirmar Nova Senha'}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
        {carregando && usuarios.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">Carregando equipe...</div>
        ) : usuarios.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            Nenhum funcionário encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/90 text-[11px] uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-4 font-semibold">Funcionário</th>
                  <th className="py-3 px-4 font-semibold">E-mail</th>
                  <th className="py-3 px-4 font-semibold">Papel</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold">Cadastro</th>
                  <th className="py-3 px-4 font-semibold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-sm">
                {usuarios.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  const busy = processandoId === u.id;

                  return (
                    <tr
                      key={u.id}
                      className={`hover:bg-slate-900/70 transition-colors ${
                        !u.ativo ? 'opacity-65' : ''
                      }`}
                    >
                      <td className="py-3 px-4 font-medium text-white">
                        <div className="flex items-center gap-2">
                          <span>{u.nome}</span>
                          {isSelf && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/30">
                              Você
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-slate-300 text-xs">{u.email}</td>
                      <td className="py-3 px-4">
                        <div className="inline-flex items-center gap-1.5">
                          <Shield
                            className={`w-3.5 h-3.5 ${
                              u.role === 'ADMIN' ? 'text-amber-300' : 'text-slate-400'
                            }`}
                          />
                          <select
                            aria-label={`Papel de ${u.nome}`}
                            value={u.role}
                            disabled={isSelf || busy}
                            title={
                              isSelf
                                ? 'Não é permitido alterar o papel da própria conta.'
                                : 'Alterar papel do usuário'
                            }
                            onChange={(e) => void handleAlterarRole(u, e.target.value as Role)}
                            className="bg-slate-950 border border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
                          >
                            <option value="FUNCIONARIO">Funcionário</option>
                            <option value="ADMIN">Administrador</option>
                          </select>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-0.5 rounded-full border ${
                            u.ativo
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                              : 'bg-red-500/10 text-red-300 border-red-500/30'
                          }`}
                        >
                          {u.ativo ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-400">
                        {formatarData(u.criadoEm)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setErro(null);
                              setFeedback(null);
                              setUsuarioSenhaAlvo(u);
                              setNovaSenha('');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition-colors"
                          >
                            <KeyRound className="w-3.5 h-3.5 text-amber-300" />
                            Redefinir Senha
                          </button>

                          <button
                            type="button"
                            disabled={isSelf || busy}
                            title={
                              isSelf
                                ? 'Não é permitido desativar a própria conta.'
                                : u.ativo
                                  ? 'Desativar conta'
                                  : 'Reativar conta'
                            }
                            onClick={() => void handleToggleAtivo(u)}
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${
                              u.ativo
                                ? 'bg-red-500/10 hover:bg-red-500/20 text-red-300 border-red-500/30'
                                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {u.ativo ? (
                              <>
                                <UserX className="w-3.5 h-3.5" />
                                Desativar
                              </>
                            ) : (
                              <>
                                <UserCheck className="w-3.5 h-3.5" />
                                Ativar
                              </>
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
