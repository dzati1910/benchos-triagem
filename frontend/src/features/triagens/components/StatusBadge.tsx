import React from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  ShieldX,
  UserCheck,
  Wrench,
} from 'lucide-react';
import type { DiagnosticoFinal, StatusTriagem } from '../../../types';
import { formatarDiagnosticoFinal, formatarStatusTriagem } from '../triagemHelpers';

interface StatusBadgeProps {
  status: StatusTriagem;
  diagnosticoFinal?: DiagnosticoFinal | null;
}

const DIAGNOSTICO_STYLE: Record<
  DiagnosticoFinal,
  { className: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  OPERACIONAL: {
    className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    Icon: CheckCircle2,
  },
  DEFEITO_FABRICA: {
    className: 'bg-red-500/15 text-red-300 border-red-500/30',
    Icon: AlertTriangle,
  },
  ENCAMINHAR_ESPECIALISTA: {
    className: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    Icon: UserCheck,
  },
  SEM_GARANTIA: {
    className: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
    Icon: ShieldX,
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, diagnosticoFinal }) => {
  if (status === 'CONCLUIDA' && diagnosticoFinal) {
    const cfg = DIAGNOSTICO_STYLE[diagnosticoFinal];
    const Icon = cfg.Icon;
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.className}`}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" />
        {formatarDiagnosticoFinal(diagnosticoFinal)}
      </span>
    );
  }

  if (status === 'EM_ANALISE') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-blue-500/15 text-blue-300 border-blue-500/30">
        <Wrench className="w-3.5 h-3.5 shrink-0" />
        {formatarStatusTriagem(status)}
      </span>
    );
  }

  if (status === 'CONCLUIDA') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        {formatarStatusTriagem(status)}
      </span>
    );
  }

  if (status === 'CANCELADA') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-slate-800 text-slate-400 border-slate-700">
        <Ban className="w-3.5 h-3.5 shrink-0" />
        {formatarStatusTriagem(status)}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border bg-amber-500/15 text-amber-300 border-amber-500/30">
      <Clock className="w-3.5 h-3.5 shrink-0" />
      {formatarStatusTriagem(status)}
    </span>
  );
};
