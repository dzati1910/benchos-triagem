import React, { useState, useEffect } from 'react';
import { TriagemDetalheResponse } from '../types';
import { fetchTriagemDetalhe } from '../services/api';
import { StatusBadge } from './StatusBadge';
import { X, Check, FileText } from 'lucide-react';

interface Props {
  triagemId: number;
  onClose: () => void;
}

export const DetalhesModal: React.FC<Props> = ({ triagemId, onClose }) => {
  const [dados, setDados] = useState<TriagemDetalheResponse | null>(null);

  useEffect(() => {
    fetchTriagemDetalhe(triagemId).then(setDados);
  }, [triagemId]);

  if (!dados) return null;
  const { triagem, itensChecklist, respostas } = dados;

  const respostasMap = new Map(respostas.map((r) => [r.item_checklist_id, r.passou === 1]));

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl">
        <div className="flex items-center justify-between pb-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-white">Prontuário Digital: OS #{triagem.id}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-xs">
          <div className="flex justify-between items-center bg-slate-900/60 p-3 rounded-lg border border-slate-700">
            <div>
              <span className="text-slate-400">Status Atual:</span>
              <div className="mt-1">
                <StatusBadge status={triagem.status} diagnostico={triagem.diagnostico_final} />
              </div>
            </div>
            <div className="text-right">
              <span className="text-slate-400">Data de Entrada:</span>
              <div className="text-slate-200 font-mono mt-1">{new Date(triagem.criado_em).toLocaleString('pt-BR')}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-slate-900/40 p-3 rounded-lg border border-slate-700/60">
            <div>
              <span className="text-slate-400">Cliente:</span>
              <div className="font-semibold text-white">{triagem.cliente_nome}</div>
              <div className="text-slate-400">{triagem.cliente_telefone || 'Sem telefone'}</div>
            </div>
            <div>
              <span className="text-slate-400">Equipamento:</span>
              <div className="font-semibold text-white">{triagem.fabricante} {triagem.modelo}</div>
              <div className="font-mono text-emerald-400">{triagem.numero_serie_mac}</div>
            </div>
          </div>

          <div className="bg-slate-900/40 p-3 rounded-lg border border-slate-700/60">
            <span className="text-slate-400">Defeito Reclamado na Entrada:</span>
            <div className="text-amber-300 mt-0.5">{triagem.defeito_reclamado}</div>
          </div>

          {triagem.status === 'CONCLUIDO' && (
            <div className="space-y-3">
              <h3 className="font-semibold text-white border-b border-slate-700 pb-1">Checklist Executado em Bancada</h3>
              <div className="space-y-1.5">
                {itensChecklist.map((item, idx) => {
                  const passou = respostasMap.get(item.id);
                  return (
                    <div key={item.id} className="flex items-center justify-between p-2 rounded bg-slate-900/30">
                      <span className="text-slate-300">{idx + 1}. {item.descricao}</span>
                      {passou ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1"><Check className="w-3.5 h-3.5" /> OK</span>
                      ) : (
                        <span className="text-rose-400 font-semibold flex items-center gap-1"><X className="w-3.5 h-3.5" /> Falhou</span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="bg-slate-900 p-3 rounded-lg border border-slate-700">
                <span className="text-slate-400">Parecer Técnico:</span>
                <div className="text-slate-200 mt-1 font-mono text-xs">{triagem.parecer_tecnico}</div>
                <div className="mt-2 text-[11px] text-slate-400">
                  Responsável: <strong className="text-white">{triagem.tecnico_responsavel}</strong>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
