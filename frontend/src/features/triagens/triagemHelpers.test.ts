import { describe, expect, it } from 'vitest';
import {
  formatarDiagnosticoFinal,
  formatarStatusSelo,
  formatarStatusTriagem,
  isTriagemAberta,
  normalizarSerialInput,
  precisaConfirmarTrocaCategoria,
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
});
