import React, { useState, useEffect } from 'react';
import { TriagemDetalheResponse, DiagnosticoFinal } from '../types';
import { fetchTriagemDetalhe, concluirTriagem } from '../services/api';
import { X, Check, AlertCircle, Wrench } from 'lucide-react';

interface Props {
  triagemId: number;
  onClose: () => void;
  onSuccess: () => void;
}

export const ChecklistModal: React.FC<Props> = ({ triagemId, onClose, onSuccess }) => {
  const [dados, setDados] = useState<TriagemDetalheResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [respostas, setRespostas] = useState<{ [itemId: number]: boolean }>({});
  const [diagnostico, setDiagnostico] = useState<DiagnosticoFinal>('OPERACIONAL');
  const [parecerTecnico, setParecerTecnico] = useState('');
  const [tecnicoResponsavel, setTecnicoResponsavel] = useState('Técnico de Bancada');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    fetchTriagemDetalhe(triagemId)
      .then((res) => {
        setDados(res);
        // Inicializa todas as respostas como verdadeiras por padrão
        const initMap: { [k: number]: boolean } = {};
        res.itensChecklist.forEach((item) => {
          initMap[item.id] = true;
        });
        setRespostas(initMap);
        setLoading(false);
      })
      .catch((err) => {
        alert(err.message);
        onClose();
      });
  }, [triagemId]);

  // Atualiza dinamicamente a sugestão de diagnóstico conforme o checklist
  const handleToggleResposta = (itemId: number, passou: boolean) => {
    const novoMap = { ...respostas, [itemId]: passou };
    setRespostas(novoMap);

    // Se qualquer teste de hardware falhar, sugere defeito de fábrica
    const todosPassaram = Object.values(novoMap).every((v) => v === true);
    if (todosPassaram) {
      setDiagnostico('OPERACIONAL');
      setParecerTecnico(
        'Equipamento testado em bancada e 100% aprovado em todos os testes técnicos. Não foi constatado defeito de fabricação. Provável falha de instalação, cabeamento ou configuração de rede do cliente.'
      );
    } else {
      setDiagnostico('DEFEITO_FABRICA');
      setParecerTecnico(
        'Falha técnica constatada durante checklist de bancada. Equipamento não atendeu aos parâmetros de funcionamento elétrico/lógico. Autorizado direcionamento para garantia/RMA.'
      );
    }
  };

  const handleSalvar = async () => {
    if (!parecerTecnico || !tecnicoResponsavel) {
      alert('Preencha o parecer técnico e o nome do responsável.');
      return;
    }

    setSalvando(true);
    try {
      const payloadRespostas = Object.entries(respostas).map(([itemId, passou]) => ({
        item_checklist_id: Number(itemId),
        passou,
      }));

      await concluirTriagem(triagemId, {
        diagnostico_final: diagnostico,
        parecer_tecnico: parecerTecnico,
        tecnico_responsavel: tecnicoResponsavel,
        respostas: payloadRespostas,
      });

      onSuccess();
    } catch (err: any) {
      alert(err.message || 'Erro ao concluir teste');
    } finally {
      setSalvando(false);
    }
  };

  if (loading || !dados) {
    return (
      <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
        <div className="text-white">Carregando checklist de bancada...</div>
      </div>
    );
  }

  const { triagem, itensChecklist } = dados;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-700">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                OS #{triagem.id}
              </span>
              <h2 className="text-xl font-bold text-white">
                Bancada de Testes: {triagem.fabricante} {triagem.modelo}
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Serial/MAC: <span className="font-mono text-emerald-400">{triagem.numero_serie_mac}</span> | Categoria: {triagem.categoria_nome}
            </p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Informações da Entrada */}
        <div className="mt-4 p-3 bg-slate-900/80 rounded-lg border border-slate-700/80 space-y-1 text-xs">
          <div className="text-slate-300">
            <strong className="text-slate-400">Cliente:</strong> {triagem.cliente_nome} {triagem.cliente_telefone ? `(${triagem.cliente_telefone})` : ''}
          </div>
          <div className="text-amber-400">
            <strong>Defeito Reclamado:</strong> {triagem.defeito_reclamado}
          </div>
        </div>

        {/* Checklist de Itens */}
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-white flex items-center gap-1.5 mb-3">
            <Wrench className="w-4 h-4 text-blue-400" /> Roteiro de Teste Técnico Padronizado
          </h3>

          <div className="space-y-2.5">
            {itensChecklist.map((item, idx) => {
              const passou = respostas[item.id] ?? true;
              return (
                <div
                  key={item.id}
                  className={`p-3 rounded-lg border flex items-center justify-between transition-colors ${
                    passou
                      ? 'bg-slate-900/40 border-slate-700/60'
                      : 'bg-rose-950/20 border-rose-800/40'
                  }`}
                >
                  <div className="flex items-start gap-2.5 max-w-[75%]">
                    <span className="text-xs font-mono text-slate-500 mt-0.5">{idx + 1}.</span>
                    <span className="text-xs text-slate-200">{item.descricao}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleToggleResposta(item.id, true)}
                      className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                        passou
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" /> OK
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleResposta(item.id, false)}
                      className={`px-3 py-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                        !passou
                          ? 'bg-rose-600 text-white shadow-sm'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      <X className="w-3.5 h-3.5" /> Falhou
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Parecer Técnico e Diagnóstico Final */}
        <div className="mt-6 pt-5 border-t border-slate-700 space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Diagnóstico Final da Bancada:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDiagnostico('OPERACIONAL')}
                className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition-all ${
                  diagnostico === 'OPERACIONAL'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-md ring-1 ring-emerald-500'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                🟢 100% Operacional
                <span className="block text-[10px] font-normal text-slate-400 mt-0.5">Sem defeito de hardware</span>
              </button>

              <button
                type="button"
                onClick={() => setDiagnostico('DEFEITO_FABRICA')}
                className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition-all ${
                  diagnostico === 'DEFEITO_FABRICA'
                    ? 'bg-rose-500/20 border-rose-500 text-rose-400 shadow-md ring-1 ring-rose-500'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                🔴 Defeito de Fábrica
                <span className="block text-[10px] font-normal text-slate-400 mt-0.5">Apto para troca / RMA</span>
              </button>

              <button
                type="button"
                onClick={() => setDiagnostico('MAU_USO')}
                className={`p-2.5 rounded-lg border text-xs font-semibold text-center transition-all ${
                  diagnostico === 'MAU_USO'
                    ? 'bg-orange-500/20 border-orange-500 text-orange-400 shadow-md ring-1 ring-orange-500'
                    : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                🟡 Dano Físico / Raio
                <span className="block text-[10px] font-normal text-slate-400 mt-0.5">Perda de garantia</span>
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-300 block mb-1">
              Parecer Técnico Detalhado:
            </label>
            <textarea
              rows={3}
              value={parecerTecnico}
              onChange={(e) => setParecerTecnico(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500 font-mono"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Técnico de Bancada Responsável:
              </label>
              <input
                type="text"
                value={tecnicoResponsavel}
                onChange={(e) => setTecnicoResponsavel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSalvar}
              disabled={salvando}
              className="px-6 py-2 text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shadow-lg shadow-emerald-950 disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Concluir Laudo de Bancada'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
