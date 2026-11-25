import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Info,
  Save,
  Sparkles,
  UserCheck,
  Wrench,
  X,
  XCircle,
} from 'lucide-react';
import {
  concluirTriagem,
  fetchTriagemDetalhe,
  iniciarAnaliseTriagem,
  salvarProgressoTriagem,
} from '../../../services/api';
import type {
  DiagnosticoFinal,
  ResultadoItemChecklist,
  Triagem,
  TriagemDetalheResponse,
} from '../../../types';
import {
  DIAGNOSTICO_FINAL_LABELS,
  formatarDataHora,
  isCategoriaArmazenamento,
  sugerirDiagnosticoEResumo,
} from '../triagemHelpers';
import { SeloBadge } from './SeloBadge';
import { StatusBadge } from './StatusBadge';

interface BancadaChecklistModalProps {
  isOpen: boolean;
  triagem: Triagem | null;
  onClose: () => void;
  onSaved: () => void;
  onAnaliseIniciada?: () => void;
}

interface RespostaFormItem {
  resultado: ResultadoItemChecklist;
  observacao: string;
  respondidoPorNome?: string | null;
}

const DIAGNOSTICO_OPCOES: Array<{
  value: DiagnosticoFinal;
  descricao: string;
  activeClass: string;
}> = [
  {
    value: 'OPERACIONAL',
    descricao: 'Testado e aprovado em bancada.',
    activeClass: 'bg-emerald-500/15 border-emerald-500/60 text-emerald-200',
  },
  {
    value: 'DEFEITO_FABRICA',
    descricao: 'Falha confirmada elegível para garantia.',
    activeClass: 'bg-red-500/15 border-red-500/60 text-red-200',
  },
  {
    value: 'ENCAMINHAR_ESPECIALISTA',
    descricao: 'Requer análise técnica aprofundada.',
    activeClass: 'bg-purple-500/15 border-purple-500/60 text-purple-200',
  },
  {
    value: 'SEM_GARANTIA',
    descricao: 'Selo violado, ausente ou inelegível.',
    activeClass: 'bg-orange-500/15 border-orange-500/60 text-orange-200',
  },
];

export const BancadaChecklistModal: React.FC<BancadaChecklistModalProps> = ({
  isOpen,
  triagem,
  onClose,
  onSaved,
  onAnaliseIniciada,
}) => {
  const [detalhe, setDetalhe] = useState<TriagemDetalheResponse | null>(null);
  const [respostas, setRespostas] = useState<Record<number, RespostaFormItem>>({});
  const [diagnosticoFinal, setDiagnosticoFinal] = useState<DiagnosticoFinal | ''>('');
  const [parecerTecnico, setParecerTecnico] = useState('');
  const [resumoCliente, setResumoCliente] = useState('');

  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [avisoSucesso, setAvisoSucesso] = useState<string | null>(null);

  const usuarioEditouTextosRef = useRef(false);
  const usuarioEscolheuDiagnosticoRef = useRef(false);
  const onAnaliseIniciadaRef = useRef(onAnaliseIniciada);
  onAnaliseIniciadaRef.current = onAnaliseIniciada;
  const triagemRef = useRef(triagem);
  triagemRef.current = triagem;

  const buildRespostasMap = (dados: TriagemDetalheResponse): Record<number, RespostaFormItem> => {
    const respostasPorItemId = new Map(
      dados.respostas.map((resp) => [resp.itemChecklistId, resp]),
    );
    const mapa: Record<number, RespostaFormItem> = {};
    for (const item of dados.itensChecklist) {
      const existente = respostasPorItemId.get(item.id);
      mapa[item.id] = {
        resultado: existente?.resultado ?? 'PENDENTE',
        observacao: existente?.observacao ?? '',
        respondidoPorNome: existente?.respondidoPor?.nome ?? null,
      };
    }
    return mapa;
  };

  const triagemId = triagem?.id ?? null;

  useEffect(() => {
    const triagemInicial = triagemRef.current;
    if (!isOpen || !triagemInicial || !triagemId) {
      return;
    }

    let cancelled = false;
    setCarregando(true);
    setErro(null);
    setAvisoSucesso(null);
    setDetalhe(null);

    const carregar = async () => {
      try {
        let iniciouAgora = false;
        if (triagemInicial.status === 'PENDENTE') {
          await iniciarAnaliseTriagem(triagemInicial.id);
          iniciouAgora = true;
        }

        const dados = await fetchTriagemDetalhe(triagemInicial.id);
        if (cancelled) {
          return;
        }

        const mapaInicial = buildRespostasMap(dados);

        setDetalhe(dados);
        setRespostas(mapaInicial);

        const temDiagnosticoSalvo = Boolean(dados.triagem.diagnosticoFinal);
        const temTextosSalvos = Boolean(
          dados.triagem.parecerTecnico?.trim() || dados.triagem.resumoCliente?.trim(),
        );
        usuarioEscolheuDiagnosticoRef.current = temDiagnosticoSalvo;
        usuarioEditouTextosRef.current = temTextosSalvos;

        if (temDiagnosticoSalvo || temTextosSalvos) {
          setDiagnosticoFinal(dados.triagem.diagnosticoFinal ?? '');
          setParecerTecnico(dados.triagem.parecerTecnico ?? '');
          setResumoCliente(dados.triagem.resumoCliente ?? '');
        } else if (dados.triagem.statusSelo !== 'INTEGRO') {
          const sugestao = sugerirDiagnosticoEResumo({
            statusSelo: dados.triagem.statusSelo,
            fabricante: dados.triagem.fabricante,
            modelo: dados.triagem.modelo,
            observacaoSelo: dados.triagem.observacaoSelo,
            itens: dados.itensChecklist.map((item) => ({
              descricao: item.descricao,
              resultado: mapaInicial[item.id]?.resultado ?? 'PENDENTE',
              observacao: mapaInicial[item.id]?.observacao ?? '',
            })),
          });
          setDiagnosticoFinal(sugestao.diagnosticoFinal);
          setParecerTecnico(sugestao.parecerTecnico);
          setResumoCliente(sugestao.resumoCliente);
        } else {
          setDiagnosticoFinal('');
          setParecerTecnico('');
          setResumoCliente('');
        }

        if (iniciouAgora) {
          onAnaliseIniciadaRef.current?.();
        }
      } catch (err) {
        if (!cancelled) {
          setErro(err instanceof Error ? err.message : 'Erro ao carregar checklist da bancada.');
        }
      } finally {
        if (!cancelled) {
          setCarregando(false);
        }
      }
    };

    void carregar();

    return () => {
      cancelled = true;
    };
  }, [isOpen, triagemId]);

  const itensAtivos = useMemo(
    () => (detalhe ? detalhe.itensChecklist.filter((item) => item.ativo) : []),
    [detalhe],
  );

  const resumoContagem = useMemo(() => {
    let aprovados = 0;
    let reprovados = 0;
    let pendentes = 0;

    for (const item of itensAtivos) {
      const resultado = respostas[item.id]?.resultado ?? 'PENDENTE';
      if (resultado === 'APROVADO') {
        aprovados += 1;
      } else if (resultado === 'REPROVADO') {
        reprovados += 1;
      } else {
        pendentes += 1;
      }
    }

    return {
      total: itensAtivos.length,
      avaliados: aprovados + reprovados,
      aprovados,
      reprovados,
      pendentes,
    };
  }, [itensAtivos, respostas]);

  if (!isOpen || !triagem) {
    return null;
  }

  const triagemAtual = detalhe?.triagem ?? triagem;
  const seloIntegro = triagemAtual.statusSelo === 'INTEGRO';
  const ehArmazenamento = isCategoriaArmazenamento(triagemAtual.categoria.nome);
  const permiteSemGarantiaIncompleto = diagnosticoFinal === 'SEM_GARANTIA' && !seloIntegro;
  const seloIntegroBloqueiaSemGarantia =
    diagnosticoFinal === 'SEM_GARANTIA' && seloIntegro && resumoContagem.pendentes > 0;
  const podeConcluir =
    Boolean(detalhe) &&
    Boolean(diagnosticoFinal) &&
    !salvando &&
    (resumoContagem.pendentes === 0 || permiteSemGarantiaIncompleto);

  const aplicarSugestao = (
    mapaRespostas: Record<number, RespostaFormItem>,
    overrideDiag?: DiagnosticoFinal,
    forcarTextos = false,
  ) => {
    if (!detalhe) {
      return;
    }

    const itensParaSugestao = detalhe.itensChecklist
      .filter((item) => item.ativo || mapaRespostas[item.id]?.resultado !== 'PENDENTE')
      .map((item) => ({
        descricao: item.descricao,
        resultado: mapaRespostas[item.id]?.resultado ?? 'PENDENTE',
        observacao: mapaRespostas[item.id]?.observacao ?? '',
      }));

    const sugestao = sugerirDiagnosticoEResumo({
      statusSelo: detalhe.triagem.statusSelo,
      fabricante: detalhe.triagem.fabricante,
      modelo: detalhe.triagem.modelo,
      observacaoSelo: detalhe.triagem.observacaoSelo,
      itens: itensParaSugestao,
      diagnosticoOverride: overrideDiag,
    });

    if (overrideDiag || !usuarioEscolheuDiagnosticoRef.current) {
      setDiagnosticoFinal(sugestao.diagnosticoFinal);
    }

    if (forcarTextos || !usuarioEditouTextosRef.current) {
      setParecerTecnico(sugestao.parecerTecnico);
      setResumoCliente(sugestao.resumoCliente);
    }
  };

  const handleResultadoChange = (itemId: number, resultado: ResultadoItemChecklist) => {
    setAvisoSucesso(null);
    const proximoMapa: Record<number, RespostaFormItem> = {
      ...respostas,
      [itemId]: {
        ...(respostas[itemId] ?? { resultado: 'PENDENTE', observacao: '' }),
        resultado,
      },
    };
    setRespostas(proximoMapa);

    if (!detalhe) {
      return;
    }

    const todosAtivosAvaliados = detalhe.itensChecklist
      .filter((item) => item.ativo)
      .every((item) => {
        const res = proximoMapa[item.id]?.resultado ?? 'PENDENTE';
        return res === 'APROVADO' || res === 'REPROVADO';
      });

    if (todosAtivosAvaliados || detalhe.triagem.statusSelo !== 'INTEGRO') {
      const diagOverride = usuarioEscolheuDiagnosticoRef.current
        ? diagnosticoFinal || undefined
        : undefined;
      aplicarSugestao(proximoMapa, diagOverride, false);
    }
  };

  const handleObservacaoChange = (itemId: number, observacao: string) => {
    setAvisoSucesso(null);
    setRespostas((prev) => ({
      ...prev,
      [itemId]: {
        ...(prev[itemId] ?? { resultado: 'PENDENTE', observacao: '' }),
        observacao,
      },
    }));
  };

  const handleSelecionarDiagnostico = (diag: DiagnosticoFinal) => {
    setAvisoSucesso(null);
    usuarioEscolheuDiagnosticoRef.current = true;
    setDiagnosticoFinal(diag);
    aplicarSugestao(respostas, diag, false);
  };

  const handleGerarSugestaoManual = () => {
    setAvisoSucesso(null);
    usuarioEditouTextosRef.current = false;
    aplicarSugestao(respostas, diagnosticoFinal || undefined, true);
  };

  const buildRespostasPayload = () => {
    if (!detalhe) {
      return [];
    }
    return detalhe.itensChecklist.map((item) => {
      const atual = respostas[item.id];
      return {
        itemChecklistId: item.id,
        resultado: atual?.resultado ?? 'PENDENTE',
        observacao: atual?.observacao.trim() ? atual.observacao.trim() : null,
      };
    });
  };

  const handleSalvarProgresso = async () => {
    if (!detalhe) {
      return;
    }

    setErro(null);
    setAvisoSucesso(null);
    setSalvando(true);

    try {
      await salvarProgressoTriagem(detalhe.triagem.id, {
        respostas: buildRespostasPayload(),
        diagnosticoFinal: diagnosticoFinal || null,
        parecerTecnico: parecerTecnico.trim() || null,
        resumoCliente: resumoCliente.trim() || null,
      });

      const atualizado = await fetchTriagemDetalhe(detalhe.triagem.id);
      setDetalhe(atualizado);
      setRespostas(buildRespostasMap(atualizado));
      setAvisoSucesso('Progresso salvo na bancada. Você pode retomar esta OS a qualquer momento.');
      onSaved();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar progresso da triagem.');
    } finally {
      setSalvando(false);
    }
  };

  const handleConcluirLaudo = async () => {
    if (!detalhe) {
      return;
    }

    if (!diagnosticoFinal) {
      setErro('Selecione o diagnóstico final antes de concluir o laudo.');
      return;
    }

    if (resumoContagem.pendentes > 0 && !permiteSemGarantiaIncompleto) {
      setErro(
        seloIntegro && diagnosticoFinal === 'SEM_GARANTIA'
          ? 'Com selo íntegro, todos os itens ativos devem ser avaliados antes de concluir como Sem Garantia.'
          : 'Avalie todos os itens ativos do checklist (OK ou Falhou) antes de concluir o laudo.',
      );
      return;
    }

    setErro(null);
    setAvisoSucesso(null);
    setSalvando(true);

    try {
      await concluirTriagem(detalhe.triagem.id, {
        diagnosticoFinal,
        parecerTecnico: parecerTecnico.trim() || null,
        resumoCliente: resumoCliente.trim() || null,
        respostas: buildRespostasPayload(),
      });
      onSaved();
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao concluir laudo da triagem.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      className="no-print fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bancada-modal-title"
    >
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-900/95">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-blue-500/15 text-blue-300 border border-blue-500/30">
                <Wrench className="w-3.5 h-3.5" />
                OS #{triagemAtual.id}
              </span>
              <StatusBadge
                status={triagemAtual.status}
                diagnosticoFinal={triagemAtual.diagnosticoFinal}
              />
              <SeloBadge
                statusSelo={triagemAtual.statusSelo}
                observacaoSelo={triagemAtual.observacaoSelo}
              />
            </div>

            <h3 id="bancada-modal-title" className="text-lg font-bold text-white">
              Bancada Guiada — {triagemAtual.fabricante} {triagemAtual.modelo}
            </h3>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
              <span>
                Categoria: <strong className="text-slate-200">{triagemAtual.categoria.nome}</strong>
              </span>
              <span>
                Serial/MAC:{' '}
                <code className="font-mono text-slate-200 bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">
                  {triagemAtual.numeroSerieMac}
                </code>
              </span>
              <span>
                Cliente: <strong className="text-slate-200">{triagemAtual.cliente.nome}</strong>
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar bancada"
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo rolável */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Trilha de Auditoria e Contexto da OS */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-950/70 border border-slate-800 rounded-xl p-4 text-xs">
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5 text-slate-400">
                <UserCheck className="w-3.5 h-3.5 text-slate-500" />
                <span>Recebido por:</span>
                <strong className="text-slate-200">{triagemAtual.recebidoPor.nome}</strong>
                <span className="text-slate-500">({formatarDataHora(triagemAtual.criadoEm)})</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <Wrench className="w-3.5 h-3.5 text-blue-400" />
                <span>Análise iniciada por:</span>
                <strong className="text-blue-200">
                  {triagemAtual.analiseIniciadaPor?.nome ?? 'Iniciando agora...'}
                </strong>
                {triagemAtual.analiseIniciadaEm && (
                  <span className="text-slate-500">
                    ({formatarDataHora(triagemAtual.analiseIniciadaEm)})
                  </span>
                )}
              </div>
              {triagemAtual.ultimaAtualizacaoPor && (
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>Última atualização por:</span>
                  <strong className="text-slate-300">
                    {triagemAtual.ultimaAtualizacaoPor.nome}
                  </strong>
                  <span className="text-slate-500">
                    ({formatarDataHora(triagemAtual.atualizadoEm)})
                  </span>
                </div>
              )}
            </div>

            <div className="space-y-1.5 border-t md:border-t-0 md:border-l border-slate-800 pt-2 md:pt-0 md:pl-4">
              <div>
                <span className="text-slate-500">Defeito reclamado:</span>{' '}
                <span className="text-slate-200">{triagemAtual.defeitoReclamado}</span>
              </div>
              {triagemAtual.acessoriosInclusos && (
                <div>
                  <span className="text-slate-500">Acessórios inclusos:</span>{' '}
                  <span className="text-slate-300">{triagemAtual.acessoriosInclusos}</span>
                </div>
              )}
              {triagemAtual.observacaoSelo && (
                <div>
                  <span className="text-slate-500">Obs. do selo:</span>{' '}
                  <span className="text-amber-300">{triagemAtual.observacaoSelo}</span>
                </div>
              )}
            </div>
          </div>

          {triagemAtual.categoria.instrucaoGeral && (
            <div className="flex items-start gap-2.5 bg-blue-500/10 border border-blue-500/25 rounded-xl px-4 py-3 text-xs text-blue-200">
              <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Orientação geral da categoria: </span>
                <span>{triagemAtual.categoria.instrucaoGeral}</span>
              </div>
            </div>
          )}

          {erro && (
            <div
              role="alert"
              className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl px-4 py-3"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span>{erro}</span>
            </div>
          )}

          {avisoSucesso && (
            <div
              role="status"
              className="flex items-start gap-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-xs rounded-xl px-4 py-3"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{avisoSucesso}</span>
            </div>
          )}

          {carregando ? (
            <div className="py-12 text-center text-sm text-slate-400">
              Carregando roteiro de testes da bancada...
            </div>
          ) : (
            <>
              {/* Barra de progresso do checklist */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/60 border border-slate-800 rounded-xl px-4 py-3">
                <div className="text-xs text-slate-300">
                  Progresso dos testes:{' '}
                  <strong className="text-white">
                    {resumoContagem.avaliados} de {resumoContagem.total}
                  </strong>{' '}
                  itens avaliados
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-300">OK: {resumoContagem.aprovados}</span>
                  <span className="text-red-300">Falhou: {resumoContagem.reprovados}</span>
                  <span className="text-amber-300">Pendentes: {resumoContagem.pendentes}</span>
                </div>
              </div>

              {/* Lista de Itens do Checklist */}
              <div className="space-y-3">
                {detalhe?.itensChecklist.length === 0 ? (
                  <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-6 text-center text-sm text-slate-400">
                    Nenhum item de checklist cadastrado para esta categoria.
                  </div>
                ) : (
                  detalhe?.itensChecklist.map((item, idx) => {
                    const atual = respostas[item.id] ?? {
                      resultado: 'PENDENTE' as ResultadoItemChecklist,
                      observacao: '',
                    };
                    const resultado = atual.resultado;

                    return (
                      <div
                        key={item.id}
                        className={`rounded-xl border p-4 space-y-3 transition-colors ${
                          resultado === 'APROVADO'
                            ? 'bg-emerald-950/20 border-emerald-500/30'
                            : resultado === 'REPROVADO'
                              ? 'bg-red-950/20 border-red-500/30'
                              : 'bg-slate-950/60 border-slate-800'
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3">
                          <div className="space-y-1.5 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-xs font-mono text-slate-500">
                                #{idx + 1}
                              </span>
                              <h4 className="text-sm font-semibold text-white">
                                {item.descricao}
                              </h4>
                              {!item.ativo && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                  Item arquivado
                                </span>
                              )}
                              {atual.respondidoPorNome && (
                                <span className="text-[11px] text-slate-400">
                                  (Registro por {atual.respondidoPorNome})
                                </span>
                              )}
                            </div>

                            <div className="text-xs text-slate-300 bg-slate-900/80 border border-slate-800/80 rounded-lg px-3 py-2">
                              <span className="font-semibold text-blue-300">Como testar: </span>
                              <span>{item.comoTestar}</span>
                            </div>
                          </div>

                          {/* 3 Botões: OK | Falhou | Pendente */}
                          <div
                            className="flex items-center gap-1.5 shrink-0"
                            role="group"
                            aria-label={`Resultado de ${item.descricao}`}
                          >
                            <button
                              type="button"
                              onClick={() => handleResultadoChange(item.id, 'APROVADO')}
                              aria-pressed={resultado === 'APROVADO'}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                resultado === 'APROVADO'
                                  ? 'bg-emerald-600 text-white border-emerald-500'
                                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-emerald-500/50 hover:text-emerald-200'
                              }`}
                            >
                              <Check className="w-3.5 h-3.5" />
                              OK
                            </button>

                            <button
                              type="button"
                              onClick={() => handleResultadoChange(item.id, 'REPROVADO')}
                              aria-pressed={resultado === 'REPROVADO'}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                resultado === 'REPROVADO'
                                  ? 'bg-red-600 text-white border-red-500'
                                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-red-500/50 hover:text-red-200'
                              }`}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Falhou
                            </button>

                            <button
                              type="button"
                              onClick={() => handleResultadoChange(item.id, 'PENDENTE')}
                              aria-pressed={resultado === 'PENDENTE'}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                resultado === 'PENDENTE'
                                  ? 'bg-amber-600 text-white border-amber-500'
                                  : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-amber-500/50 hover:text-amber-200'
                              }`}
                            >
                              <Clock className="w-3.5 h-3.5" />
                              Pendente
                            </button>
                          </div>
                        </div>

                        <div>
                          <input
                            type="text"
                            value={atual.observacao}
                            onChange={(e) => handleObservacaoChange(item.id, e.target.value)}
                            aria-label={`Observação para ${item.descricao}`}
                            placeholder={
                              ehArmazenamento
                                ? 'Ex: S.M.A.R.T. Saudável, 1.250h de uso, 0 setores realocados, temp. 36°C'
                                : 'Observação técnica deste item (medições, sintomas, nº da porta, etc.)'
                            }
                            className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Diagnóstico Final, Parecer Técnico e Resumo para Cliente */}
              <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      Diagnóstico Final &amp; Resumo para Atendimento
                    </h4>
                    <p className="text-xs text-slate-400">
                      Selecione o diagnóstico e revise o parecer interno e a mensagem para o cliente.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleGerarSugestaoManual}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-200 text-xs font-medium transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    Sugerir com base nos testes
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {DIAGNOSTICO_OPCOES.map((opcao) => {
                    const selecionado = diagnosticoFinal === opcao.value;
                    return (
                      <button
                        key={opcao.value}
                        type="button"
                        onClick={() => handleSelecionarDiagnostico(opcao.value)}
                        aria-pressed={selecionado}
                        className={`text-left p-3 rounded-xl border transition-colors ${
                          selecionado
                            ? opcao.activeClass
                            : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-semibold">
                          {DIAGNOSTICO_FINAL_LABELS[opcao.value]}
                        </div>
                        <div className="text-[11px] opacity-80 mt-0.5">{opcao.descricao}</div>
                      </button>
                    );
                  })}
                </div>

                {seloIntegroBloqueiaSemGarantia && (
                  <div
                    role="alert"
                    className="flex items-start gap-2.5 bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs rounded-xl px-4 py-3"
                  >
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                    <span>
                      Este equipamento possui <strong>Selo Íntegro</strong>. Para concluir o laudo
                      como <strong>Sem Garantia</strong> com itens ainda pendentes, é necessário que
                      o selo esteja Violado ou Sem Selo. Avalie os {resumoContagem.pendentes} item(ns)
                      pendente(s) para concluir.
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="bancada-parecer-tecnico"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Parecer Técnico Interno (uso da equipe)
                    </label>
                    <textarea
                      id="bancada-parecer-tecnico"
                      rows={4}
                      value={parecerTecnico}
                      onChange={(e) => {
                        usuarioEditouTextosRef.current = true;
                        setParecerTecnico(e.target.value);
                      }}
                      placeholder="Registre medições, códigos S.M.A.R.T., evidências técnicas e observações internas..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="bancada-resumo-cliente"
                      className="block text-xs font-medium text-slate-300 mb-1.5"
                    >
                      Resumo para Atendimento ao Cliente (balcão / WhatsApp)
                    </label>
                    <textarea
                      id="bancada-resumo-cliente"
                      rows={4}
                      value={resumoCliente}
                      onChange={(e) => {
                        usuarioEditouTextosRef.current = true;
                        setResumoCliente(e.target.value);
                      }}
                      placeholder="Texto claro e objetivo para entrega ao cliente sem jargão interno..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Rodapé de Ações */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/95 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {resumoContagem.pendentes > 0 && !permiteSemGarantiaIncompleto ? (
              <span>
                Há <strong className="text-amber-300">{resumoContagem.pendentes}</strong> item(ns)
                pendente(s). Salve o progresso para continuar depois ou conclua todos os testes.
              </span>
            ) : !diagnosticoFinal ? (
              <span>Escolha um Diagnóstico Final para habilitar a conclusão do laudo.</span>
            ) : (
              <span className="text-emerald-300">Pronto para concluir o laudo técnico.</span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={salvando}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors disabled:opacity-50"
            >
              Fechar
            </button>

            <button
              type="button"
              onClick={() => void handleSalvarProgresso()}
              disabled={carregando || salvando || !detalhe}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-200 text-xs font-semibold border border-blue-500/40 transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Salvar Progresso
            </button>

            <button
              type="button"
              onClick={() => void handleConcluirLaudo()}
              disabled={!podeConcluir}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-lg shadow-emerald-950 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4" />
              Concluir Laudo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
