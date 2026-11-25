import React from 'react';
import { StatusTriagem, DiagnosticoFinal } from '../types';
import { CheckCircle2, AlertTriangle, XCircle, Clock } from 'lucide-react';

interface Props {
  status: StatusTriagem;
  diagnostico?: DiagnosticoFinal;
}

export const StatusBadge: React.FC<Props> = ({ status, diagnostico }) => {
  if (status === 'PENDENTE') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
        <Clock className="w-3.5 h-3.5" />
        Aguardando Bancada
      </span>
    );
  }

  if (status === 'CONCLUIDO') {
    if (diagnostico === 'OPERACIONAL') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-3.5 h-3.5" />
          100% Operacional (Sem Defeito)
        </span>
      );
    }
    if (diagnostico === 'DEFEITO_FABRICA') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
          <XCircle className="w-3.5 h-3.5" />
          Defeito Confirmado (RMA/Troca)
        </span>
      );
    }
    if (diagnostico === 'MAU_USO') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-500/10 text-orange-400 border border-orange-500/20">
          <AlertTriangle className="w-3.5 h-3.5" />
          Dano Físico / Sem Garantia
        </span>
      );
    }
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
      Em Análise Técnica
    </span>
  );
};
