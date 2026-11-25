import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Check,
  Copy,
  FileText,
  Printer,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { fetchTriagemDetalhe, reabrirTriagem } from '../../../services/api';
import type { ResultadoItemChecklist, Triagem, TriagemDetalheResponse } from '../../../types';
import {
  formatarDataHora,
  formatarDiagnosticoFinal,
  formatarResultadoItem,
  formatarResumoWhatsApp,
  formatarStatusSelo,
  sugerirDiagnosticoEResumo,
} from '../triagemHelpers';
import { SeloBadge } from './SeloBadge';
import { StatusBadge } from './StatusBadge';

interface ProntuarioResumoModalProps {
  isOpen: boolean;
  triagem: Triagem | null;
  onClose: () => void;
  onReopened?: (triagem: Triagem) => void;
}

const RESULTADO_BADGE_CLASS: Record<ResultadoItemChecklist, string> = {
  APROVADO: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  REPROVADO: 'bg-red-500/15 text-red-300 border-red-500/30',
  PENDENTE: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  NAO_TESTADO: 'bg-slate-800 text-slate-300 border-slate-700',
};

export const ProntuarioResumoModal: React.FC<ProntuarioResumoModalProps> = ({
  isOpen,
  triagem,
  onClose,
  onReopened,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';

  const [detalhe, setDetalhe] = useState<TriagemDetalheResponse | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [confirmandoReabertura, setConfirmandoReabertura] = useState(false);
  const [reabrindo, setReabrindo] = useState(false);

  const triagemId = triagem?.id ?? null;

  useEffect(() => {
    if (!isOpen || !triagemId) {
      return;
    }

    let cancelled = false;
    setCarregando(true);
    setErro(null);
    setDetalhe(null);
    setCopiado(false);
    setConfirmandoReabertura(false);

    fetchTriagemDetalhe(triagemId)
      .then((dados) => {
        if (!cancelled) {
          setDetalhe(dados);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setErro(err instanceof Error ? err.message : 'Erro ao carregar prontuário da OS.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setCarregando(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, triagemId]);

  if (!isOpen || !triagem) {
    return null;
  }

  const triagemAtual = detalhe?.triagem ?? triagem;
  const respostasPorItemId = new Map(
    (detalhe?.respostas ?? []).map((resp) => [resp.itemChecklistId, resp]),
  );

  const resumoClienteTexto =
    triagemAtual.resumoCliente?.trim() ||
    (triagemAtual.diagnosticoFinal
      ? sugerirDiagnosticoEResumo({
          statusSelo: triagemAtual.statusSelo,
          fabricante: triagemAtual.fabricante,
          modelo: triagemAtual.modelo,
          observacaoSelo: triagemAtual.observacaoSelo,
          diagnosticoOverride: triagemAtual.diagnosticoFinal,
          itens: [],
        }).resumoCliente
      : 'Triagem sem resumo registrado para atendimento.');

  const handleCopiarWhatsApp = async () => {
    const texto = formatarResumoWhatsApp({
      ...triagemAtual,
      resumoCliente: resumoClienteTexto,
    });
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2500);
    } catch {
      setErro('Não foi possível copiar automaticamente. Selecione e copie o resumo manualmente.');
    }
  };

  const handleImprimir = () => {
    window.print();
  };

  const handleConfirmarReabertura = async () => {
    setErro(null);
    setReabrindo(true);
    try {
      const reaberta = await reabrirTriagem(triagemAtual.id);
      onReopened?.(reaberta);
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao reabrir a OS.');
    } finally {
      setReabrindo(false);
    }
  };

  return (
    <div
      className="print-modal-root fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prontuario-modal-title"
    >
      <div className="print-summary bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Cabeçalho */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-start justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-mono font-semibold px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <FileText className="w-3.5 h-3.5" />
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

            <h3 id="prontuario-modal-title" className="text-lg font-bold text-white">
              Prontuário Técnico — {triagemAtual.fabricante} {triagemAtual.modelo}
            </h3>

            <p className="text-xs text-slate-400">
              BenchOS Distribuição • Emissão em {formatarDataHora(triagemAtual.concluidoEm ?? triagemAtual.atualizadoEm)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar prontuário"
            className="no-print p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {erro && (
            <div
              role="alert"
              className="no-print flex items-start gap-2.5 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-xl px-4 py-3"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
              <span>{erro}</span>
            </div>
          )}

          {/* Dados do Cliente e Equipamento */}
          <div className="print-box grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-xs">
            <div className="space-y-1.5">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                Cliente &amp; Equipamento
              </div>
              <div>
                <span className="text-slate-500">Cliente:</span>{' '}
                <strong className="text-white">{triagemAtual.cliente.nome}</strong>
                {triagemAtual.cliente.telefone && (
                  <span className="text-slate-400"> • {triagemAtual.cliente.telefone}</span>
                )}
              </div>
              <div>
                <span className="text-slate-500">Equipamento:</span>{' '}
                <strong className="text-slate-200">
                  {triagemAtual.fabricante} {triagemAtual.modelo}
                </strong>{' '}
                <span className="text-slate-400">({triagemAtual.categoria.nome})</span>
              </div>
              <div>
                <span className="text-slate-500">Serial / MAC:</span>{' '}
                <code className="font-mono text-slate-200">{triagemAtual.numeroSerieMac}</code>
              </div>
              <div>
                <span className="text-slate-500">Selo de garantia:</span>{' '}
                <span className="text-slate-200">{formatarStatusSelo(triagemAtual.statusSelo)}</span>
                {triagemAtual.observacaoSelo && (
                  <span className="text-slate-400"> — {triagemAtual.observacaoSelo}</span>
                )}
              </div>
            </div>

            <div className="space-y-1.5 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-4">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                Relato de Entrada &amp; Resultado
              </div>
              <div>
                <span className="text-slate-500">Defeito reclamado:</span>{' '}
                <span className="text-slate-200">{triagemAtual.defeitoReclamado}</span>
              </div>
              {triagemAtual.acessoriosInclusos && (
                <div>
                  <span className="text-slate-500">Acessórios:</span>{' '}
                  <span className="text-slate-300">{triagemAtual.acessoriosInclusos}</span>
                </div>
              )}
              {triagemAtual.diagnosticoFinal && (
                <div>
                  <span className="text-slate-500">Diagnóstico final:</span>{' '}
                  <strong className="text-emerald-300">
                    {formatarDiagnosticoFinal(triagemAtual.diagnosticoFinal)}
                  </strong>
                </div>
              )}
            </div>
          </div>

          {/* Bloco Destacado: Resumo para Atendimento ao Cliente */}
          <div className="print-box bg-blue-950/25 border border-blue-500/35 rounded-xl p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
                <h4 className="text-sm font-bold text-white">
                  Resumo para Atendimento ao Cliente
                </h4>
              </div>

              <div className="no-print flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopiarWhatsApp()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 text-xs font-semibold transition-colors"
                >
                  {copiado ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      Copiar para WhatsApp
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleImprimir}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Imprimir
                </button>
              </div>
            </div>

            <p className="text-sm text-slate-100 leading-relaxed whitespace-pre-line">
              {resumoClienteTexto}
            </p>
          </div>

          {/* Trilha Completa de Responsáveis */}
          <div className="print-box bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-slate-400">
              <UserCheck className="w-3.5 h-3.5" />
              Trilha de Auditoria (Responsáveis)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <div className="text-slate-500">Recebido por</div>
                <div className="font-semibold text-slate-200">{triagemAtual.recebidoPor.nome}</div>
                <div className="text-[11px] text-slate-500">
                  {formatarDataHora(triagemAtual.criadoEm)}
                </div>
              </div>
              <div>
                <div className="text-slate-500">Análise iniciada por</div>
                <div className="font-semibold text-slate-200">
                  {triagemAtual.analiseIniciadaPor?.nome ?? '-'}
                </div>
                <div className="text-[11px] text-slate-500">
                  {formatarDataHora(triagemAtual.analiseIniciadaEm)}
                </div>
              </div>
              <div>
                <div className="text-slate-500">
                  {triagemAtual.canceladoPor ? 'Cancelado por' : 'Laudo concluído por'}
                </div>
                <div className="font-semibold text-slate-200">
                  {triagemAtual.canceladoPor?.nome ?? triagemAtual.concluidoPor?.nome ?? '-'}
                </div>
                <div className="text-[11px] text-slate-500">
                  {formatarDataHora(triagemAtual.canceladoEm ?? triagemAtual.concluidoEm)}
                </div>
              </div>
            </div>
            {triagemAtual.ultimaAtualizacaoPor && (
              <div className="no-print text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                Última atualização por:{' '}
                <strong className="text-slate-300">
                  {triagemAtual.ultimaAtualizacaoPor.nome}
                </strong>{' '}
                em {formatarDataHora(triagemAtual.atualizadoEm)}
              </div>
            )}
          </div>

          {/* Resultados do Checklist */}
          <div className="space-y-2.5">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-slate-400">
              Checklist de Testes Executados
            </h4>

            {carregando ? (
              <div className="py-6 text-center text-xs text-slate-400">
                Carregando itens e observações do checklist...
              </div>
            ) : detalhe && detalhe.itensChecklist.length > 0 ? (
              <div className="divide-y divide-slate-800 border border-slate-800 rounded-xl overflow-hidden bg-slate-950/50">
                {detalhe.itensChecklist.map((item, idx) => {
                  const resp = respostasPorItemId.get(item.id);
                  const resultado = resp?.resultado ?? 'PENDENTE';

                  return (
                    <div key={item.id} className="p-3.5 flex flex-col sm:flex-row sm:items-start justify-between gap-2 text-xs">
                      <div className="space-y-1">
                        <div className="font-medium text-slate-100">
                          <span className="font-mono text-slate-500 mr-2">#{idx + 1}</span>
                          {item.descricao}
                        </div>
                        {resp?.observacao && (
                          <div className="text-slate-300">
                            <span className="text-slate-500">Observação:</span> {resp.observacao}
                          </div>
                        )}
                        {resp?.respondidoPor && (
                          <div className="no-print text-[11px] text-slate-500">
                            Registrado por {resp.respondidoPor.nome}
                          </div>
                        )}
                      </div>

                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border shrink-0 self-start ${RESULTADO_BADGE_CLASS[resultado]}`}
                      >
                        {formatarResultadoItem(resultado)}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-slate-400 bg-slate-950/40 border border-slate-800 rounded-xl p-4">
                Nenhuma resposta de checklist registrada nesta triagem.
              </div>
            )}
          </div>

          {/* Parecer Técnico Interno (não impresso no comprovante do cliente) */}
          {triagemAtual.parecerTecnico && (
            <div className="no-print bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-1.5">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-400">
                Parecer Técnico Interno (restrito à equipe)
              </div>
              <p className="text-xs text-slate-200 leading-relaxed whitespace-pre-line">
                {triagemAtual.parecerTecnico}
              </p>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="no-print px-6 py-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-900/95">
          <div>
            {isAdmin && triagemAtual.status === 'CONCLUIDA' && (
              confirmandoReabertura ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-amber-300">
                    Reabrir esta OS para &ldquo;Em Análise&rdquo;?
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleConfirmarReabertura()}
                    disabled={reabrindo}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    {reabrindo ? 'Reabrindo...' : 'Confirmar Reabertura'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmandoReabertura(false)}
                    disabled={reabrindo}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmandoReabertura(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-200 text-xs font-semibold transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reabrir OS
                </button>
              )
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
