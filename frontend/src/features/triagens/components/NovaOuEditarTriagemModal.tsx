import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Ban,
  Check,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  UserPlus,
  X,
} from 'lucide-react';
import {
  ApiError,
  cancelarTriagem,
  criarCliente,
  criarTriagem,
  editarTriagem,
  fetchReincidenciaSerial,
} from '../../../services/api';
import type { Categoria, Cliente, ReincidenciaItem, StatusSelo, Triagem } from '../../../types';
import {
  STATUS_SELO_DESCRICOES,
  STATUS_SELO_LABELS,
  formatarDataHora,
  formatarDiagnosticoFinal,
  formatarStatusSelo,
  formatarStatusTriagem,
  normalizarSerialInput,
  precisaConfirmarTrocaCategoria,
} from '../triagemHelpers';

interface NovaOuEditarTriagemModalProps {
  isOpen: boolean;
  triagemEdicao?: Triagem | null;
  categorias: Categoria[];
  clientes: Cliente[];
  onClose: () => void;
  onSaved: (triagem: Triagem) => void;
  onCanceled?: (triagem: Triagem) => void;
  onClienteCreated?: (cliente: Cliente) => void;
}

const SELO_OPCOES: Array<{
  value: StatusSelo;
  Icon: React.ComponentType<{ className?: string }>;
  activeClass: string;
}> = [
  {
    value: 'INTEGRO',
    Icon: ShieldCheck,
    activeClass: 'bg-emerald-500/15 border-emerald-500/60 text-emerald-200',
  },
  {
    value: 'VIOLADO',
    Icon: ShieldAlert,
    activeClass: 'bg-red-500/15 border-red-500/60 text-red-200',
  },
  {
    value: 'SEM_SELO',
    Icon: ShieldOff,
    activeClass: 'bg-amber-500/15 border-amber-500/60 text-amber-200',
  },
];

export const NovaOuEditarTriagemModal: React.FC<NovaOuEditarTriagemModalProps> = ({
  isOpen,
  triagemEdicao,
  categorias,
  clientes,
  onClose,
  onSaved,
  onCanceled,
  onClienteCreated,
}) => {
  const isEditMode = Boolean(triagemEdicao);

  const [clienteId, setClienteId] = useState<string>('');
  const [categoriaId, setCategoriaId] = useState<string>('');
  const [fabricante, setFabricante] = useState('');
  const [modelo, setModelo] = useState('');
  const [numeroSerieMac, setNumeroSerieMac] = useState('');
  const [statusSelo, setStatusSelo] = useState<StatusSelo | ''>('');
  const [observacaoSelo, setObservacaoSelo] = useState('');
  const [defeitoReclamado, setDefeitoReclamado] = useState('');
  const [acessoriosInclusos, setAcessoriosInclusos] = useState('');

  const [reincidencias, setReincidencias] = useState<ReincidenciaItem[]>([]);
  const [buscandoReincidencia, setBuscandoReincidencia] = useState(false);

  const [mostrarNovoCliente, setMostrarNovoCliente] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState('');
  const [novoClienteTelefone, setNovoClienteTelefone] = useState('');
  const [novoClienteDocumento, setNovoClienteDocumento] = useState('');
  const [salvandoCliente, setSalvandoCliente] = useState(false);
  const [erroNovoCliente, setErroNovoCliente] = useState<string | null>(null);

  const [confirmarLimparChecklist, setConfirmarLimparChecklist] = useState(false);
  const [exigirConfirmacao409, setExigirConfirmacao409] = useState(false);
  const [confirmandoCancelamento, setConfirmandoCancelamento] = useState(false);
  const [cancelando, setCancelando] = useState(false);

  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const serialReqCounterRef = useRef(0);
  const ultimoSerialConsultadoRef = useRef('');

  const categoriasDisponiveis = React.useMemo(() => {
    const ativas = categorias.filter((cat) => cat.ativo);
    if (triagemEdicao && !ativas.some((cat) => cat.id === triagemEdicao.categoriaId)) {
      return [triagemEdicao.categoria, ...ativas];
    }
    return ativas;
  }, [categorias, triagemEdicao]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setErro(null);
    setErroNovoCliente(null);
    setMostrarNovoCliente(false);
    setNovoClienteNome('');
    setNovoClienteTelefone('');
    setNovoClienteDocumento('');
    setConfirmarLimparChecklist(false);
    setExigirConfirmacao409(false);
    setConfirmandoCancelamento(false);
    setReincidencias([]);
    setBuscandoReincidencia(false);
    serialReqCounterRef.current += 1;
    ultimoSerialConsultadoRef.current = '';

    if (triagemEdicao) {
      setClienteId(String(triagemEdicao.clienteId));
      setCategoriaId(String(triagemEdicao.categoriaId));
      setFabricante(triagemEdicao.fabricante);
      setModelo(triagemEdicao.modelo);
      setNumeroSerieMac(triagemEdicao.numeroSerieMac);
      setStatusSelo(triagemEdicao.statusSelo);
      setObservacaoSelo(triagemEdicao.observacaoSelo ?? '');
      setDefeitoReclamado(triagemEdicao.defeitoReclamado);
      setAcessoriosInclusos(triagemEdicao.acessoriosInclusos ?? '');
    } else {
      setClienteId('');
      setCategoriaId('');
      setFabricante('');
      setModelo('');
      setNumeroSerieMac('');
      setStatusSelo('');
      setObservacaoSelo('');
      setDefeitoReclamado('');
      setAcessoriosInclusos('');
    }
  }, [isOpen, triagemEdicao]);

  const consultarReincidencia = async (serialBruto: string, force = false) => {
    const normalizado = normalizarSerialInput(serialBruto);
    if (!normalizado || normalizado.length < 3) {
      serialReqCounterRef.current += 1;
      setBuscandoReincidencia(false);
      setReincidencias([]);
      ultimoSerialConsultadoRef.current = '';
      return;
    }

    if (!force && ultimoSerialConsultadoRef.current === normalizado) {
      return;
    }

    ultimoSerialConsultadoRef.current = normalizado;
    const reqId = ++serialReqCounterRef.current;
    setBuscandoReincidencia(true);

    try {
      const historico = await fetchReincidenciaSerial(normalizado, triagemEdicao?.id);
      if (serialReqCounterRef.current === reqId) {
        setReincidencias(historico);
      }
    } catch {
      if (serialReqCounterRef.current === reqId) {
        setReincidencias([]);
      }
    } finally {
      if (serialReqCounterRef.current === reqId) {
        setBuscandoReincidencia(false);
      }
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const normalizado = normalizarSerialInput(numeroSerieMac);
    if (normalizado.length < 3) {
      serialReqCounterRef.current += 1;
      setBuscandoReincidencia(false);
      setReincidencias([]);
      ultimoSerialConsultadoRef.current = '';
      return;
    }

    const timer = window.setTimeout(() => {
      void consultarReincidencia(numeroSerieMac);
    }, 350);

    return () => {
      window.clearTimeout(timer);
    };
  }, [isOpen, numeroSerieMac, triagemEdicao?.id]);

  if (!isOpen) {
    return null;
  }

  const categoriaSelecionadaNum = Number(categoriaId);
  const trocaCategoriaEmAnalise =
    isEditMode &&
    triagemEdicao != null &&
    Number.isInteger(categoriaSelecionadaNum) &&
    categoriaSelecionadaNum > 0 &&
    precisaConfirmarTrocaCategoria(
      triagemEdicao.status,
      triagemEdicao.categoriaId,
      categoriaSelecionadaNum,
    );

  const exigeConfirmacaoLimpeza = trocaCategoriaEmAnalise || exigirConfirmacao409;
  const serialNormalizadoPreview = normalizarSerialInput(numeroSerieMac);

  const handleSerialBlur = () => {
    const normalizado = normalizarSerialInput(numeroSerieMac);
    if (normalizado !== numeroSerieMac) {
      setNumeroSerieMac(normalizado);
    }
    void consultarReincidencia(normalizado, true);
  };

  const handleCriarClienteInline = async () => {
    setErroNovoCliente(null);
    const nome = novoClienteNome.trim();
    if (!nome) {
      setErroNovoCliente('Informe o nome do cliente.');
      return;
    }

    setSalvandoCliente(true);
    try {
      const novoCliente = await criarCliente({
        nome,
        telefone: novoClienteTelefone.trim() || null,
        documento: novoClienteDocumento.trim() || null,
      });
      onClienteCreated?.(novoCliente);
      setClienteId(String(novoCliente.id));
      setNovoClienteNome('');
      setNovoClienteTelefone('');
      setNovoClienteDocumento('');
      setMostrarNovoCliente(false);
    } catch (err) {
      setErroNovoCliente(
        err instanceof Error ? err.message : 'Não foi possível cadastrar o cliente.',
      );
    } finally {
      setSalvandoCliente(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErro(null);

    const clienteIdNum = Number(clienteId);
    const categoriaIdNum = Number(categoriaId);
    const serialFinal = normalizarSerialInput(numeroSerieMac);

    if (!Number.isInteger(clienteIdNum) || clienteIdNum <= 0) {
      setErro('Selecione um cliente ou cadastre um novo antes de continuar.');
      return;
    }

    if (!Number.isInteger(categoriaIdNum) || categoriaIdNum <= 0) {
      setErro('Selecione a categoria do equipamento.');
      return;
    }

    if (!fabricante.trim() || !modelo.trim() || !serialFinal) {
      setErro('Preencha fabricante, modelo e número de série/MAC.');
      return;
    }

    if (!statusSelo) {
      setErro('Selecione obrigatoriamente a condição do selo da loja na entrada.');
      return;
    }

    if (!defeitoReclamado.trim()) {
      setErro('Descreva o defeito reclamado pelo cliente.');
      return;
    }

    if (exigeConfirmacaoLimpeza && !confirmarLimparChecklist) {
      setErro(
        'Confirme que deseja alterar a categoria e limpar as respostas parciais do checklist para prosseguir.',
      );
      return;
    }

    setSalvando(true);
    try {
      if (isEditMode && triagemEdicao) {
        const atualizada = await editarTriagem(triagemEdicao.id, {
          clienteId: clienteIdNum,
          categoriaId: categoriaIdNum,
          fabricante: fabricante.trim(),
          modelo: modelo.trim(),
          numeroSerieMac: serialFinal,
          statusSelo,
          observacaoSelo: observacaoSelo.trim() || null,
          defeitoReclamado: defeitoReclamado.trim(),
          acessoriosInclusos: acessoriosInclusos.trim() || null,
          ...(exigeConfirmacaoLimpeza && confirmarLimparChecklist
            ? { limparRespostasAnteriores: true }
            : {}),
        });
        onSaved(atualizada);
      } else {
        const criada = await criarTriagem({
          clienteId: clienteIdNum,
          categoriaId: categoriaIdNum,
          fabricante: fabricante.trim(),
          modelo: modelo.trim(),
          numeroSerieMac: serialFinal,
          statusSelo,
          observacaoSelo: observacaoSelo.trim() || null,
          defeitoReclamado: defeitoReclamado.trim(),
          acessoriosInclusos: acessoriosInclusos.trim() || null,
        });
        onSaved(criada);
      }
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.status === 409 &&
        err.code === 'CHECKLIST_CONFIRM_CLEAR_REQUIRED'
      ) {
        setExigirConfirmacao409(true);
        setConfirmarLimparChecklist(false);
        setErro(err.message);
      } else {
        setErro(err instanceof Error ? err.message : 'Erro ao salvar a triagem.');
      }
    } finally {
      setSalvando(false);
    }
  };

  const handleConfirmarCancelamento = async () => {
    if (!triagemEdicao) {
      return;
    }

    setErro(null);
    setCancelando(true);
    try {
      const cancelada = await cancelarTriagem(triagemEdicao.id);
      onCanceled?.(cancelada);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível cancelar a OS.');
      setConfirmandoCancelamento(false);
    } finally {
      setCancelando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-triagem-titulo"
    >
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl my-6 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between gap-4">
          <div>
            <h2 id="modal-triagem-titulo" className="text-lg font-semibold text-white">
              {isEditMode && triagemEdicao
                ? `Editar Ordem de Serviço #${triagemEdicao.id}`
                : 'Nova Triagem na Bancada'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {isEditMode
                ? 'Atualize os dados da OS aberta ou realize o cancelamento lógico.'
                : 'Registre os dados de entrada, inspeção do selo e defeito relatado.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[82vh] overflow-y-auto">
          {erro && (
            <div
              role="alert"
              className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl px-3.5 py-3"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span>{erro}</span>
            </div>
          )}

          {/* Cliente + Cadastro Rápido */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="triagem-cliente" className="block text-xs font-medium text-slate-300">
                Cliente *
              </label>
              <button
                type="button"
                onClick={() => {
                  setMostrarNovoCliente((prev) => !prev);
                  setErroNovoCliente(null);
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
              >
                <UserPlus className="w-3.5 h-3.5" />
                {mostrarNovoCliente ? 'Fechar cadastro rápido' : '+ Novo Cliente'}
              </button>
            </div>

            <select
              id="triagem-cliente"
              value={clienteId}
              onChange={(e) => setClienteId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Selecione o cliente...</option>
              {clientes.map((cli) => (
                <option key={cli.id} value={cli.id}>
                  {cli.nome}
                  {cli.telefone ? ` — ${cli.telefone}` : ''}
                </option>
              ))}
            </select>

            {mostrarNovoCliente && (
              <div className="bg-slate-950/90 border border-slate-700 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-300">
                    Cadastro Rápido de Cliente
                  </span>
                </div>

                {erroNovoCliente && (
                  <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
                    {erroNovoCliente}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-1">
                    <label
                      htmlFor="novo-cliente-nome"
                      className="block text-[11px] font-medium text-slate-400 mb-1"
                    >
                      Nome / Empresa *
                    </label>
                    <input
                      id="novo-cliente-nome"
                      type="text"
                      value={novoClienteNome}
                      onChange={(e) => setNovoClienteNome(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleCriarClienteInline();
                        }
                      }}
                      placeholder="Ex: João Silva / Cond. Alfa"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="novo-cliente-telefone"
                      className="block text-[11px] font-medium text-slate-400 mb-1"
                    >
                      Telefone / WhatsApp
                    </label>
                    <input
                      id="novo-cliente-telefone"
                      type="text"
                      value={novoClienteTelefone}
                      onChange={(e) => setNovoClienteTelefone(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleCriarClienteInline();
                        }
                      }}
                      placeholder="(11) 99999-9999"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="novo-cliente-documento"
                      className="block text-[11px] font-medium text-slate-400 mb-1"
                    >
                      CPF / CNPJ
                    </label>
                    <input
                      id="novo-cliente-documento"
                      type="text"
                      value={novoClienteDocumento}
                      onChange={(e) => setNovoClienteDocumento(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          void handleCriarClienteInline();
                        }
                      }}
                      placeholder="Opcional"
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setMostrarNovoCliente(false)}
                    className="px-3 py-1.5 rounded-lg text-xs text-slate-300 hover:bg-slate-800 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCriarClienteInline}
                    disabled={salvandoCliente}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-xs font-medium transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {salvandoCliente ? 'Salvando...' : 'Salvar Cliente'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Categoria + Equipamento */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="triagem-categoria"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Categoria *
              </label>
              <select
                id="triagem-categoria"
                value={categoriaId}
                onChange={(e) => {
                  setCategoriaId(e.target.value);
                  setConfirmarLimparChecklist(false);
                  setExigirConfirmacao409(false);
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">Selecione...</option>
                {categoriasDisponiveis.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nome}
                    {!cat.ativo ? ' (Inativa)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="triagem-fabricante"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Fabricante / Marca *
              </label>
              <input
                id="triagem-fabricante"
                type="text"
                value={fabricante}
                onChange={(e) => setFabricante(e.target.value)}
                placeholder="Ex: Hikvision, Seagate, AGL"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="triagem-modelo"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Modelo *
              </label>
              <input
                id="triagem-modelo"
                type="text"
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                placeholder="Ex: DS-2CE16D0T, ST2000VX015"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {exigeConfirmacaoLimpeza && (
            <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-4 space-y-2.5">
              <div className="flex items-start gap-2.5 text-amber-200 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <div>
                  <p className="font-semibold">
                    Atenção: alteração de categoria em triagem já em análise
                  </p>
                  <p className="text-amber-200/80 mt-0.5">
                    Esta OS já iniciou testes na bancada. Ao trocar a categoria, eventuais
                    respostas parciais registradas no checklist anterior serão apagadas.
                  </p>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-amber-100 cursor-pointer select-none pl-6">
                <input
                  type="checkbox"
                  checked={confirmarLimparChecklist}
                  onChange={(e) => setConfirmarLimparChecklist(e.target.checked)}
                  className="rounded border-amber-500/50 bg-slate-950 text-amber-500 focus:ring-amber-500"
                />
                Confirmo a troca de categoria e a limpeza das respostas anteriores do checklist.
              </label>
            </div>
          )}

          {/* Serial / MAC Manual + Reincidência */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="triagem-serial" className="block text-xs font-medium text-slate-300">
                Número de Série ou MAC (digitação manual) *
              </label>
              {buscandoReincidencia && (
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                  <RefreshCw className="w-3 h-3 animate-spin" />
                  Consultando histórico...
                </span>
              )}
            </div>
            <input
              id="triagem-serial"
              type="text"
              value={numeroSerieMac}
              onChange={(e) => setNumeroSerieMac(e.target.value)}
              onBlur={handleSerialBlur}
              placeholder="Digite manualmente, ex: SN4K08A123 ou AA:BB:CC:11:22:33"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
              <span>
                Digite manualmente conforme a etiqueta do equipamento. Espaços nas pontas serão
                removidos e letras convertidas para maiúsculas.
              </span>
              {serialNormalizadoPreview && serialNormalizadoPreview !== numeroSerieMac && (
                <span className="text-blue-300 font-mono">
                  Normalizado: {serialNormalizadoPreview}
                </span>
              )}
            </div>

            {reincidencias.length > 0 && (
              <div
                role="status"
                aria-live="polite"
                className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-3.5 space-y-2"
              >
                <div className="flex items-center gap-2 text-amber-300 text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
                  <span>
                    Reincidência detectada: {reincidencias.length}{' '}
                    {reincidencias.length === 1
                      ? 'registro anterior encontrado'
                      : 'registros anteriores encontrados'}{' '}
                    para este Serial/MAC
                  </span>
                </div>
                <ul className="space-y-1.5 text-xs text-amber-100/90">
                  {reincidencias.map((item) => (
                    <li
                      key={item.id}
                      className="bg-slate-950/60 border border-amber-500/20 rounded-lg px-3 py-2 flex flex-wrap items-center justify-between gap-2"
                    >
                      <div>
                        <span className="font-semibold text-white">OS #{item.id}</span> ·{' '}
                        <span>
                          {item.fabricante} {item.modelo}
                        </span>{' '}
                        · <span className="text-slate-300">{item.cliente.nome}</span>
                      </div>
                      <div className="text-[11px] text-amber-200 flex flex-wrap items-center gap-2">
                        <span>{formatarDataHora(item.criadoEm)}</span>
                        <span>•</span>
                        <span>{formatarStatusSelo(item.statusSelo)}</span>
                        <span>•</span>
                        <span>
                          {item.status === 'CONCLUIDA' && item.diagnosticoFinal
                            ? formatarDiagnosticoFinal(item.diagnosticoFinal)
                            : formatarStatusTriagem(item.status)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Selo da Loja */}
          <div className="space-y-2.5">
            <span className="block text-xs font-medium text-slate-300">
              Estado do Selo de Garantia da Loja na Entrada *
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {SELO_OPCOES.map(({ value, Icon, activeClass }) => {
                const selected = statusSelo === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatusSelo(value)}
                    aria-pressed={selected}
                    className={`text-left p-3 rounded-xl border transition-colors ${
                      selected
                        ? activeClass
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                        <Icon className="w-4 h-4 shrink-0" />
                        {STATUS_SELO_LABELS[value]}
                      </span>
                      {selected && <Check className="w-3.5 h-3.5 shrink-0" />}
                    </div>
                    <p className="text-[11px] opacity-80 mt-1 leading-snug">
                      {STATUS_SELO_DESCRICOES[value]}
                    </p>
                  </button>
                );
              })}
            </div>

            <div>
              <label
                htmlFor="triagem-obs-selo"
                className="block text-xs font-medium text-slate-400 mb-1"
              >
                Observação sobre o selo (opcional)
              </label>
              <input
                id="triagem-obs-selo"
                type="text"
                value={observacaoSelo}
                onChange={(e) => setObservacaoSelo(e.target.value)}
                placeholder="Ex: Selo rasgado próximo ao parafuso lateral / etiqueta desbotada"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Defeito e Acessórios */}
          <div className="space-y-4">
            <div>
              <label
                htmlFor="triagem-defeito"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Defeito Reclamado pelo Cliente *
              </label>
              <textarea
                id="triagem-defeito"
                rows={3}
                value={defeitoReclamado}
                onChange={(e) => setDefeitoReclamado(e.target.value)}
                placeholder="Descreva os sintomas relatados pelo cliente na entrega do equipamento..."
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label
                htmlFor="triagem-acessorios"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Acessórios Inclusos (opcional)
              </label>
              <input
                id="triagem-acessorios"
                type="text"
                value={acessoriosInclusos}
                onChange={(e) => setAcessoriosInclusos(e.target.value)}
                placeholder="Ex: Fonte 12V, caixa original, cabo SATA (ou 'Somente equipamento')"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* Rodapé de Ações */}
          <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <div>
              {isEditMode && triagemEdicao && (
                <>
                  {!confirmandoCancelamento ? (
                    <button
                      type="button"
                      onClick={() => setConfirmandoCancelamento(true)}
                      disabled={salvando || cancelando}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-300 text-xs font-medium transition-colors"
                    >
                      <Ban className="w-3.5 h-3.5" />
                      Cancelar OS
                    </button>
                  ) : (
                    <div className="inline-flex items-center gap-2 bg-red-500/10 border border-red-500/40 rounded-lg px-3 py-1.5">
                      <span className="text-xs text-red-200">
                        Confirmar cancelamento da OS #{triagemEdicao.id}?
                      </span>
                      <button
                        type="button"
                        onClick={handleConfirmarCancelamento}
                        disabled={cancelando}
                        className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 disabled:opacity-60 text-white text-xs font-semibold"
                      >
                        {cancelando ? 'Cancelando...' : 'Confirmar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmandoCancelamento(false)}
                        disabled={cancelando}
                        className="px-2 py-1 rounded text-xs text-slate-300 hover:text-white"
                      >
                        Voltar
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center gap-2.5 ml-auto">
              <button
                type="button"
                onClick={onClose}
                disabled={salvando || cancelando}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium transition-colors"
              >
                Fechar
              </button>
              <button
                type="submit"
                disabled={salvando || cancelando}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white text-sm font-semibold shadow-lg shadow-blue-950 transition-colors"
              >
                {salvando
                  ? 'Salvando...'
                  : isEditMode
                    ? 'Salvar Alterações'
                    : 'Registrar Triagem'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
