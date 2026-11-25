import { describe, expect, it } from 'vitest';
import {
  formatarDiagnosticoFinal,
  formatarResumoWhatsApp,
  formatarStatusSelo,
  formatarStatusTriagem,
  isTriagemAberta,
  normalizarSerialInput,
  precisaConfirmarTrocaCategoria,
  sugerirDiagnosticoEResumo,
} from './triagemHelpers';

describe('triagemHelpers', () => {
  describe('normalizarSerialInput', () => {
    it('remove espaços das pontas e converte caracteres para maiúsculas', () => {
      expect(normalizarSerialInput(' 4k08a ')).toBe('4K08A');
      expect(normalizarSerialInput('  aa:bb:cc:11:22:33  ')).toBe('AA:BB:CC:11:22:33');
      expect(normalizarSerialInput('')).toBe('');
    });
  });

  describe('formatarStatusSelo', () => {
    it('formata todos os valores de StatusSelo em português claro', () => {
      expect(formatarStatusSelo('INTEGRO')).toBe('Selo Íntegro');
      expect(formatarStatusSelo('VIOLADO')).toBe('Selo Violado');
      expect(formatarStatusSelo('SEM_SELO')).toBe('Sem Selo');
    });
  });

  describe('formatarStatusTriagem', () => {
    it('formata todos os valores de StatusTriagem', () => {
      expect(formatarStatusTriagem('PENDENTE')).toBe('Aguardando Bancada');
      expect(formatarStatusTriagem('EM_ANALISE')).toBe('Em Análise');
      expect(formatarStatusTriagem('CONCLUIDA')).toBe('Concluída');
      expect(formatarStatusTriagem('CANCELADA')).toBe('Cancelada');
    });
  });

  describe('formatarDiagnosticoFinal', () => {
    it('formata todos os diagnósticos finais incluindo encaminhamento e sem garantia', () => {
      expect(formatarDiagnosticoFinal('OPERACIONAL')).toBe('Operacional');
      expect(formatarDiagnosticoFinal('DEFEITO_FABRICA')).toBe('Defeito de Fábrica');
      expect(formatarDiagnosticoFinal('ENCAMINHAR_ESPECIALISTA')).toBe(
        'Encaminhar ao Especialista',
      );
      expect(formatarDiagnosticoFinal('SEM_GARANTIA')).toBe('Sem Garantia');
    });
  });

  describe('precisaConfirmarTrocaCategoria', () => {
    it('retorna true somente quando a triagem está EM_ANALISE e a categoria mudou', () => {
      expect(precisaConfirmarTrocaCategoria('EM_ANALISE', 1, 2)).toBe(true);
      expect(precisaConfirmarTrocaCategoria('EM_ANALISE', 1, 1)).toBe(false);
      expect(precisaConfirmarTrocaCategoria('PENDENTE', 1, 2)).toBe(false);
      expect(precisaConfirmarTrocaCategoria('CONCLUIDA', 1, 2)).toBe(false);
      expect(precisaConfirmarTrocaCategoria('CANCELADA', 1, 2)).toBe(false);
      expect(precisaConfirmarTrocaCategoria('EM_ANALISE', null, 2)).toBe(false);
    });
  });

  describe('isTriagemAberta', () => {
    it('identifica corretamente triagens abertas (PENDENTE ou EM_ANALISE)', () => {
      expect(isTriagemAberta('PENDENTE')).toBe(true);
      expect(isTriagemAberta('EM_ANALISE')).toBe(true);
      expect(isTriagemAberta('CONCLUIDA')).toBe(false);
      expect(isTriagemAberta('CANCELADA')).toBe(false);
    });
  });

  describe('sugerirDiagnosticoEResumo', () => {
    it('sugere OPERACIONAL e texto educativo sobre fonte e cabeamento quando todos os itens são APROVADO', () => {
      const sugestao = sugerirDiagnosticoEResumo({
        statusSelo: 'INTEGRO',
        fabricante: 'Intelbras',
        modelo: 'VHD 1220 B',
        itens: [
          { descricao: 'Teste de imagem em bancada', resultado: 'APROVADO', observacao: 'Imagem nítida' },
          { descricao: 'Teste de IR noturno', resultado: 'APROVADO', observacao: null },
        ],
      });

      expect(sugestao.diagnosticoFinal).toBe('OPERACIONAL');
      expect(sugestao.parecerTecnico).toContain('aprovado');
      expect(sugestao.resumoCliente.toLowerCase()).toContain('fonte');
      expect(sugestao.resumoCliente.toLowerCase()).toContain('cabeamento');
      expect(sugestao.resumoCliente).toContain('Intelbras VHD 1220 B');
    });

    it('sugere DEFEITO_FABRICA quando algum item é REPROVADO e inclui os itens reprovados', () => {
      const sugestao = sugerirDiagnosticoEResumo({
        statusSelo: 'INTEGRO',
        fabricante: 'Seagate',
        modelo: 'SkyHawk 2TB',
        itens: [
          { descricao: 'Reconhecimento SATA', resultado: 'APROVADO', observacao: null },
          {
            descricao: 'Saúde S.M.A.R.T.',
            resultado: 'REPROVADO',
            observacao: '128 setores realocados, 4200h',
          },
        ],
      });

      expect(sugestao.diagnosticoFinal).toBe('DEFEITO_FABRICA');
      expect(sugestao.parecerTecnico).toContain('Saúde S.M.A.R.T.');
      expect(sugestao.parecerTecnico).toContain('128 setores realocados');
      expect(sugestao.resumoCliente).toContain('Seagate SkyHawk 2TB');
      expect(sugestao.resumoCliente).toContain('Saúde S.M.A.R.T.');
    });

    it('gera resumo explicando encaminhamento para análise técnica avançada em ENCAMINHAR_ESPECIALISTA', () => {
      const sugestao = sugerirDiagnosticoEResumo({
        statusSelo: 'INTEGRO',
        fabricante: 'Hikvision',
        modelo: 'DS-7208HQHI',
        diagnosticoOverride: 'ENCAMINHAR_ESPECIALISTA',
        itens: [
          { descricao: 'Alimentação placa-mãe', resultado: 'APROVADO', observacao: null },
          { descricao: 'Saída HDMI/VGA', resultado: 'PENDENTE', observacao: 'Intermitente' },
        ],
      });

      expect(sugestao.diagnosticoFinal).toBe('ENCAMINHAR_ESPECIALISTA');
      expect(sugestao.resumoCliente.toLowerCase()).toContain('especialista');
      expect(sugestao.resumoCliente.toLowerCase()).toContain('análise');
      expect(sugestao.parecerTecnico).toContain('Intermitente');
    });

    it('sugere SEM_GARANTIA quando statusSelo não é INTEGRO e explica inelegibilidade sem jargão interno', () => {
      const sugestao = sugerirDiagnosticoEResumo({
        statusSelo: 'VIOLADO',
        fabricante: 'Control iD',
        modelo: 'iDFace',
        observacaoSelo: 'Lacre rompido no parafuso traseiro',
        itens: [{ descricao: 'Inspeção física', resultado: 'PENDENTE', observacao: null }],
      });

      expect(sugestao.diagnosticoFinal).toBe('SEM_GARANTIA');
      expect(sugestao.parecerTecnico).toContain('Selo Violado');
      expect(sugestao.resumoCliente.toLowerCase()).toContain('garantia');
      expect(sugestao.resumoCliente.toLowerCase()).toContain('selo');
    });
  });

  describe('formatarResumoWhatsApp', () => {
    it('inclui modelo, serial, selo e resumo claro para cliente sem jargão interno', () => {
      const texto = formatarResumoWhatsApp({
        id: 42,
        fabricante: 'Intelbras',
        modelo: 'MHDX 1008',
        numeroSerieMac: 'SN-4K08A-99',
        statusSelo: 'INTEGRO',
        diagnosticoFinal: 'OPERACIONAL',
        resumoCliente:
          'O equipamento (Intelbras MHDX 1008) foi testado em bancada e apresentou funcionamento normal.',
        cliente: { nome: 'João Silva' },
      });

      expect(texto).toContain('OS #42');
      expect(texto).toContain('Intelbras MHDX 1008');
      expect(texto).toContain('SN-4K08A-99');
      expect(texto).toContain('Selo Íntegro');
      expect(texto).toContain('Operacional');
      expect(texto).toContain('funcionamento normal');
      expect(texto).not.toContain('parecerTecnico');
    });
  });
});
