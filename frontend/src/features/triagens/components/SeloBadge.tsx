import React from 'react';
import { ShieldAlert, ShieldCheck, ShieldOff } from 'lucide-react';
import type { StatusSelo } from '../../../types';
import { formatarStatusSelo } from '../triagemHelpers';

interface SeloBadgeProps {
  statusSelo: StatusSelo;
  observacaoSelo?: string | null;
  showObservacao?: boolean;
}

const SELO_STYLE: Record<
  StatusSelo,
  { className: string; Icon: React.ComponentType<{ className?: string }> }
> = {
  INTEGRO: {
    className: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    Icon: ShieldCheck,
  },
  VIOLADO: {
    className: 'bg-red-500/15 text-red-300 border-red-500/30',
    Icon: ShieldAlert,
  },
  SEM_SELO: {
    className: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    Icon: ShieldOff,
  },
};

export const SeloBadge: React.FC<SeloBadgeProps> = ({
  statusSelo,
  observacaoSelo,
  showObservacao = false,
}) => {
  const { className, Icon } = SELO_STYLE[statusSelo];
  const label = formatarStatusSelo(statusSelo);
  const obs = observacaoSelo?.trim();

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <span
        title={obs ? `${label}: ${obs}` : label}
        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${className}`}
      >
        <Icon className="w-3.5 h-3.5 shrink-0" />
        {label}
      </span>
      {showObservacao && obs && (
        <span className="text-[11px] text-slate-400 leading-snug max-w-[220px] truncate" title={obs}>
          {obs}
        </span>
      )}
    </div>
  );
};
