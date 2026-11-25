import React, { useState } from 'react';
import { Categoria, Cliente } from '../types';
import { criarCliente, criarTriagem } from '../services/api';
import { X, Plus, UserPlus } from 'lucide-react';

interface Props {
  categorias: Categoria[];
  clientes: Cliente[];
  onClose: () => void;
  onSuccess: () => void;
  onClienteCadastrado: () => void;
}

export const NovaTriagemModal: React.FC<Props> = ({
  categorias,
  clientes,
  onClose,
  onSuccess,
  onClienteCadastrado
}) => {
  const [clienteId, setClienteId] = useState<number>(clientes[0]?.id || 0);
  const [categoriaId, setCategoriaId] = useState<number>(categorias[0]?.id || 0);
  const [modelo, setModelo] = useState('');
  const [fabricante, setFabricante] = useState('Intelbras');
  const [numeroSerieMac, setNumeroSerieMac] = useState('');
  const [defeitoReclamado, setDefeitoReclamado] = useState('');
  const [acessoriosInclusos, setAcessoriosInclusos] = useState('Sem acessórios');
  const [loading, setLoading] = useState(false);

  // Modal rápido de novo cliente
  const [mostrarNovoCliente, setMostrarNovoCliente] = useState(false);
  const [novoClienteNome, setNovoClienteNome] = useState('');
  const [novoClienteTelefone, setNovoClienteTelefone] = useState('');

  const handleSalvarCliente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoClienteNome) return;
    try {
      const c = await criarCliente(novoClienteNome, novoClienteTelefone);
      setClienteId(c.id);
      setMostrarNovoCliente(false);
      onClienteCadastrado();
    } catch {
      alert('Erro ao cadastrar cliente');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteId || !categoriaId || !modelo || !numeroSerieMac || !defeitoReclamado) {
      alert('Preencha os campos obrigatórios!');
      return;
    }

    setLoading(true);
    try {
      await criarTriagem({
        cliente_id: clienteId,
        categoria_id: categoriaId,
        modelo,
        fabricante,
        numero_serie_mac: numeroSerieMac,
        defeito_reclamado: defeitoReclamado,
        acessorios_inclusos: acessoriosInclusos,
      });
      onSuccess();
    } catch (err: any) {
      alert(err.message || 'Erro ao registrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 border border-slate-700 rounded-xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-white">Nova Entrada para Triagem</h2>
            <p className="text-sm text-slate-400">Registre o equipamento para análise na bancada</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        {mostrarNovoCliente ? (
          <form onSubmit={handleSalvarCliente} className="mt-4 p-4 bg-slate-900/60 rounded-lg border border-slate-700 space-y-3">
            <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-1.5">
              <UserPlus className="w-4 h-4" /> Cadastro Rápido de Cliente / Instalador
            </h3>
            <div>
              <label className="block text-xs font-medium text-slate-300">Nome / Razão Social *</label>
              <input
                type="text"
                required
                value={novoClienteNome}
                onChange={(e) => setNovoClienteNome(e.target.value)}
                className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                placeholder="Ex: Seguranca Total Telecom"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300">WhatsApp / Telefone</label>
              <input
                type="text"
                value={novoClienteTelefone}
                onChange={(e) => setNovoClienteTelefone(e.target.value)}
                className="mt-1 w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                placeholder="(11) 99999-0000"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMostrarNovoCliente(false)}
                className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg"
              >
                Salvar Cliente
              </button>
            </div>
          </form>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">Cliente / Instalador *</label>
                <button
                  type="button"
                  onClick={() => setMostrarNovoCliente(true)}
                  className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Novo
                </button>
              </div>
              <select
                value={clienteId}
                onChange={(e) => setClienteId(Number(e.target.value))}
                className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} {c.telefone ? `(${c.telefone})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300">Categoria do Produto *</label>
              <select
                value={categoriaId}
                onChange={(e) => setCategoriaId(Number(e.target.value))}
                className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                {categorias.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-300">Fabricante *</label>
              <input
                type="text"
                required
                value={fabricante}
                onChange={(e) => setFabricante(e.target.value)}
                className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="Ex: Intelbras, Hikvision, TP-Link"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-slate-300">Modelo *</label>
              <input
                type="text"
                required
                value={modelo}
                onChange={(e) => setModelo(e.target.value)}
                className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                placeholder="Ex: VHD 1120 B, DS-7204, SF 900 PoE"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
              <span>Número de Série ou MAC Address *</span>
              <span className="text-[11px] text-blue-400 font-mono">Use o leitor USB ou digite</span>
            </label>
            <input
              type="text"
              required
              value={numeroSerieMac}
              onChange={(e) => setNumeroSerieMac(e.target.value)}
              className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono text-emerald-400 focus:outline-none focus:border-emerald-500 uppercase tracking-wider"
              placeholder="Ex: 4K08A3700147B ou A0:B1:C2:D3:E4:F5"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300">Defeito Reclamado pelo Cliente *</label>
            <textarea
              required
              rows={2}
              value={defeitoReclamado}
              onChange={(e) => setDefeitoReclamado(e.target.value)}
              className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              placeholder="Ex: Cliente alega que não liga e não acende LED após chuva..."
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-300">Acessórios Inclusos</label>
            <input
              type="text"
              value={acessoriosInclusos}
              onChange={(e) => setAcessoriosInclusos(e.target.value)}
              className="mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              placeholder="Ex: Veio com fonte original 12V 1A e conector P4"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-slate-400 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Salvando...' : 'Registrar Equipamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
